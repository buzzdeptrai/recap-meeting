import type { Channel } from "@recap/core";
import type { RepoContext, StoredSegment } from "../types";
import { toStoredSegment, type SegmentRow } from "./segment-row";
import { createSegmentPager } from "./segment-pages";

export interface InsertSegmentInput {
  meetingId: string;
  seq: number;
  channel: Channel;
  lang: string | null;
  startMs: number;
  endMs: number;
  text: string;
}

export function createSegmentsRepository(context: RepoContext) {
  const { db, now, newId } = context;
  const insertStmt = db.prepare(
    `INSERT INTO segments (id, meeting_id, seq, channel, lang, start_ms, end_ms, text, created_at)
     VALUES (@id, @meetingId, @seq, @channel, @lang, @startMs, @endMs, @text, @createdAt)`,
  );
  const listStmt = db.prepare<[string], SegmentRow>(
    "SELECT * FROM segments WHERE meeting_id = ? ORDER BY seq",
  );
  const maxSeqStmt = db.prepare<[string], { maxSeq: number | null }>(
    "SELECT MAX(seq) AS maxSeq FROM segments WHERE meeting_id = ?",
  );

  const latestStmt = db.prepare<[string], { latest: string | null }>(
    "SELECT MAX(created_at) AS latest FROM segments WHERE meeting_id = ?",
  );

  function insert(input: InsertSegmentInput): StoredSegment {
    const segment: StoredSegment = { ...input, id: newId(), createdAt: now() };
    insertStmt.run(segment);
    return segment;
  }

  function listByMeeting(meetingId: string): StoredSegment[] {
    return listStmt.all(meetingId).map(toStoredSegment);
  }

  /** Next ordering key for a meeting (0 when empty); used when resuming. */
  function nextSeq(meetingId: string): number {
    const maxSeq = maxSeqStmt.get(meetingId)?.maxSeq;
    return maxSeq === null || maxSeq === undefined ? 0 : maxSeq + 1;
  }

  /** Creation time of the newest segment (null when none); used for minutes staleness. */
  function latestCreatedAt(meetingId: string): string | null {
    return latestStmt.get(meetingId)?.latest ?? null;
  }

  return { insert, listByMeeting, nextSeq, latestCreatedAt, ...createSegmentPager(context) };
}

export type SegmentsRepository = ReturnType<typeof createSegmentsRepository>;
