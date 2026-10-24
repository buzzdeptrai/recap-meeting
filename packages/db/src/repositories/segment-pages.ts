import type { RepoContext, StoredSegment } from "../types";
import { toStoredSegment, type SegmentRow } from "./segment-row";
import { searchTranscript } from "./transcript-search";

export const DEFAULT_PAGE_SIZE = 200;
export const MAX_PAGE_SIZE = 500;

export type PageDirection = "forward" | "backward";

export interface SegmentPageOptions {
  /**
   * Cursor (a `seq`). Forward: first segment to return (inclusive; default = the first segment).
   * Backward: return the segments *before* it (exclusive; default = the end of the meeting).
   */
  from?: number;
  /** Clamped to 1..MAX_PAGE_SIZE (default DEFAULT_PAGE_SIZE). */
  limit?: number;
  dir?: PageDirection;
}

export interface SegmentPage {
  /** Ascending by seq, whatever the direction. */
  segments: StoredSegment[];
  /** `from` for the next forward page (the seq of the next existing segment); null at the end. */
  nextCursor: number | null;
  /** `from` for the next backward page (= first returned seq); null when nothing precedes. */
  prevCursor: number | null;
  /** Every segment of the meeting. */
  total: number;
}

export interface LocateTarget {
  /** Time on the meeting timeline (ms). Ignored when `seq` is given. */
  atMs?: number;
  seq?: number;
  /** Page size the caller will request: the returned `from` leaves half a page before the target. */
  limit?: number;
}

export interface LocateResult {
  segmentId: string;
  seq: number;
  startMs: number;
  /** Forward cursor of a page that contains the segment, roughly centred on it. */
  from: number;
}

export interface SegmentAnchor {
  id: string;
  seq: number;
  startMs: number;
  text: string;
}

export interface TranscriptStats {
  segments: number;
  words: number;
  translated: number;
}

export const clampPageLimit = (limit: number | undefined): number =>
  Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limit ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE));

export function createSegmentPager(context: RepoContext) {
  const { db } = context;
  const forwardStmt = db.prepare<[string, number, number], SegmentRow>(
    "SELECT * FROM segments WHERE meeting_id = ? AND seq >= ? ORDER BY seq LIMIT ?",
  );
  const backwardStmt = db.prepare<[string, number, number], SegmentRow>(
    "SELECT * FROM segments WHERE meeting_id = ? AND seq < ? ORDER BY seq DESC LIMIT ?",
  );
  const countStmt = db.prepare<[string], { n: number }>(
    "SELECT COUNT(*) AS n FROM segments WHERE meeting_id = ?",
  );
  const nextAfterStmt = db.prepare<[string, number], { seq: number }>(
    "SELECT seq FROM segments WHERE meeting_id = ? AND seq > ? ORDER BY seq LIMIT 1",
  );
  const hasBeforeStmt = db.prepare<[string, number], { seq: number }>(
    "SELECT seq FROM segments WHERE meeting_id = ? AND seq < ? LIMIT 1",
  );

  const count = (meetingId: string): number => countStmt.get(meetingId)?.n ?? 0;

  function page(meetingId: string, options: SegmentPageOptions = {}): SegmentPage {
    const limit = clampPageLimit(options.limit);
    const backward = options.dir === "backward";
    const rows = backward
      ? backwardStmt.all(meetingId, options.from ?? Number.MAX_SAFE_INTEGER, limit).reverse()
      : forwardStmt.all(meetingId, options.from ?? Number.MIN_SAFE_INTEGER, limit);
    const segments = rows.map(toStoredSegment);
    const first = segments[0];
    const last = segments.at(-1);
    return {
      segments,
      nextCursor: last ? (nextAfterStmt.get(meetingId, last.seq)?.seq ?? null) : null,
      prevCursor: first && hasBeforeStmt.get(meetingId, first.seq) ? first.seq : null,
      total: count(meetingId),
    };
  }

  return {
    page,
    count,
    ...createLocator(db),
    ...createStats(db, count),
    search: createSearch(context),
  };
}

type Db = RepoContext["db"];

function createLocator(db: Db) {
  const bySeqStmt = db.prepare<[string, number], SegmentRow>(
    "SELECT * FROM segments WHERE meeting_id = ? AND seq = ?",
  );
  const lastStartedStmt = db.prepare<[string, number], SegmentRow>(
    "SELECT * FROM segments WHERE meeting_id = ? AND start_ms <= ? ORDER BY seq DESC LIMIT 1",
  );
  const firstLaterStmt = db.prepare<[string, number], SegmentRow>(
    "SELECT * FROM segments WHERE meeting_id = ? AND start_ms > ? ORDER BY seq LIMIT 1",
  );
  const firstSeqStmt = db.prepare<[string], { seq: number | null }>(
    "SELECT MIN(seq) AS seq FROM segments WHERE meeting_id = ?",
  );
  const stepBackStmt = db.prepare<[string, number, number], { seq: number }>(
    "SELECT seq FROM segments WHERE meeting_id = ? AND seq <= ? ORDER BY seq DESC LIMIT 1 OFFSET ?",
  );

  /** The segment spanning `atMs`, else the closest by distance to its span (earlier wins ties). */
  function nearestTo(meetingId: string, atMs: number): SegmentRow | undefined {
    const before = lastStartedStmt.get(meetingId, atMs);
    if (before && atMs <= before.end_ms) return before;
    const after = firstLaterStmt.get(meetingId, atMs);
    if (!before) return after;
    if (!after) return before;
    return after.start_ms - atMs < atMs - before.end_ms ? after : before;
  }

  function locate(meetingId: string, target: LocateTarget): LocateResult | undefined {
    const row =
      target.seq !== undefined
        ? bySeqStmt.get(meetingId, target.seq)
        : nearestTo(meetingId, target.atMs ?? 0);
    if (!row) return undefined;
    const half = Math.floor(clampPageLimit(target.limit) / 2);
    const from =
      stepBackStmt.get(meetingId, row.seq, half)?.seq ?? firstSeqStmt.get(meetingId)?.seq;
    return { segmentId: row.id, seq: row.seq, startMs: row.start_ms, from: from ?? row.seq };
  }

  /** Segment a mark points at: the last one that started at or before `atMs` (rail text + jump). */
  function anchorAt(meetingId: string, atMs: number): SegmentAnchor | undefined {
    const row = lastStartedStmt.get(meetingId, atMs);
    return row ? { id: row.id, seq: row.seq, startMs: row.start_ms, text: row.text } : undefined;
  }

  return { locate, anchorAt };
}

function createStats(db: Db, count: (meetingId: string) => number) {
  const statsStmt = db.prepare<[string], { words: number | null }>(
    `SELECT SUM(CASE WHEN trim(text) = '' THEN 0
                     ELSE length(trim(text)) - length(replace(trim(text), ' ', '')) + 1 END) AS words
       FROM segments WHERE meeting_id = ?`,
  );
  const translatedStmt = db.prepare<[string], { n: number }>(
    `SELECT COUNT(DISTINCT t.segment_id) AS n FROM translations t
       JOIN segments s ON s.id = t.segment_id WHERE s.meeting_id = ?`,
  );

  /** Whole-meeting counters for the room's session panel (the client holds only a window). */
  function stats(meetingId: string): TranscriptStats {
    return {
      segments: count(meetingId),
      words: statsStmt.get(meetingId)?.words ?? 0,
      translated: translatedStmt.get(meetingId)?.n ?? 0,
    };
  }

  return { stats };
}

/** FTS hits of `q` inside one meeting (see `searchTranscript`). */
function createSearch(context: RepoContext) {
  return (meetingId: string, q: string, limit?: number) =>
    searchTranscript(context, meetingId, q, limit);
}
