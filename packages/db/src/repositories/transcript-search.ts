import type { RepoContext } from "../types";
import { buildFtsQuery, buildSnippet, comparable, searchTerms } from "./meeting-search";

export const DEFAULT_HIT_LIMIT = 200;
export const MAX_HIT_LIMIT = 500;
const FALLBACK_SNIPPET_CHARS = 120;

export type HitSource = "text" | "translation";

export interface TranscriptHit {
  segmentId: string;
  seq: number;
  startMs: number;
  /** Escaped HTML excerpt with `<mark>` around the matched words. */
  snippet: string;
  /** Where the words were found; the original text wins when both match. */
  source: HitSource;
}

export interface TranscriptSearchResult {
  hits: TranscriptHit[];
  /** More segments matched than `limit`. */
  truncated: boolean;
  /** Folded, lower-case query words (the client highlights rows with them). */
  terms: string[];
}

interface HitRow {
  id: string;
  seq: number;
  start_ms: number;
  text: string;
  translation: string | null;
}

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Every query term starts some word of `text` (what the ANDed FTS query requires). */
function matchesAll(text: string, terms: string[]): boolean {
  const words = (text.match(/[\p{L}\p{N}\p{M}]+/gu) ?? []).map(comparable);
  return terms.every((term) => words.some((word) => word.startsWith(term)));
}

function toHit(row: HitRow, terms: string[]): TranscriptHit {
  const fromText = matchesAll(row.text, terms);
  const translated = row.translation && !fromText ? buildSnippet(row.translation, terms) : null;
  const source: HitSource = fromText || translated === null ? "text" : "translation";
  const own = buildSnippet(row.text, terms);
  const snippet = translated ?? own ?? escape(row.text.slice(0, FALLBACK_SNIPPET_CHARS));
  return { segmentId: row.id, seq: row.seq, startMs: row.start_ms, snippet, source };
}

/**
 * Segments of one meeting whose text or translation matches `q` (FTS5, diacritics-insensitive,
 * every word a prefix term, ANDed), ordered by seq. One hit per segment.
 */
export function searchTranscript(
  { db }: RepoContext,
  meetingId: string,
  q: string,
  limit = DEFAULT_HIT_LIMIT,
): TranscriptSearchResult {
  const fts = buildFtsQuery(q);
  if (fts === null) return { hits: [], truncated: false, terms: [] };
  const cap = Math.min(MAX_HIT_LIMIT, Math.max(1, Math.floor(limit)));
  const rows = db
    .prepare<[string, string, string, number], HitRow>(
      `SELECT s.id, s.seq, s.start_ms, s.text,
              (SELECT t.text FROM translations t WHERE t.segment_id = s.id ORDER BY t.lang LIMIT 1)
                AS translation
         FROM segments s
        WHERE s.meeting_id = ?
          AND (s.rowid IN (SELECT rowid FROM segments_fts WHERE segments_fts MATCH ?)
               OR s.id IN (SELECT t.segment_id FROM translations t
                            WHERE t.rowid IN (SELECT rowid FROM translations_fts
                                               WHERE translations_fts MATCH ?)))
        ORDER BY s.seq LIMIT ?`,
    )
    .all(meetingId, fts, fts, cap + 1);
  const terms = searchTerms(q);
  return {
    hits: rows.slice(0, cap).map((row) => toHit(row, terms)),
    truncated: rows.length > cap,
    terms,
  };
}
