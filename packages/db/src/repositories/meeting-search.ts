import type { MinutesLang } from "@recap/core";
import type { Meeting, RepoContext } from "../types";
import { loadMeetingExtras, agendaPreview, type MeetingExtras } from "./meeting-list-extras";
import {
  queryMeetingList,
  type ListQueryOptions,
  type ListQueryResult,
} from "./meeting-list-query";
import { toMeeting } from "./meetings";

export type SearchMeetingsOptions = ListQueryOptions;

export interface MeetingSearchHit extends Meeting, MeetingExtras {
  /** Escaped excerpt with `<mark>…</mark>` around matches; only when `q` matched transcript text. */
  snippet?: string;
  /** Languages that have stored minutes. */
  hasMinutes: MinutesLang[];
  /** First non-empty agenda line. */
  agendaPreview?: string;
}

export interface MeetingSearchResult {
  meetings: MeetingSearchHit[];
  /** Matches before limit/offset. */
  total: number;
  counts: ListQueryResult["counts"];
  totals: ListQueryResult["totals"];
}

const MAX_TERMS = 8;
const MAX_TERM_LENGTH = 64;
/** Mirrors the index-side fold of đ/Đ (see migration 003). */
const foldD = (text: string) => text.replaceAll("đ", "d").replaceAll("Đ", "D");

/**
 * Turns user text into a safe FTS5 query: every word becomes a quoted prefix term, ANDed.
 * Only letters/digits survive, so operators, quotes, `-`, `*`, `:` can never reach the parser.
 * Returns null when nothing searchable is left.
 */
export function buildFtsQuery(q: string): string | null {
  const words = foldD(q.normalize("NFC")).match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = words.slice(0, MAX_TERMS).map((w) => `"${w.slice(0, MAX_TERM_LENGTH)}"*`);
  return terms.length > 0 ? terms.join(" ") : null;
}

/** Folded, lowercase query words (same segmentation as buildFtsQuery). */
export function searchTerms(q: string): string[] {
  const words = foldD(q.normalize("NFC")).match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.slice(0, MAX_TERMS).map((w) => comparable(w.slice(0, MAX_TERM_LENGTH)));
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
/** Lowercase, drop combining marks, fold đ: the same equivalence the index uses. */
export const comparable = (word: string) =>
  foldD(word.toLowerCase()).normalize("NFD").replace(/\p{M}/gu, "");

const WORD = /[\p{L}\p{N}\p{M}]+/gu;
const CONTEXT_BEFORE = 40;
const CONTEXT_AFTER = 80;

/** Escaped excerpt of `text` with every word that starts with a query term wrapped in <mark>. */
export function buildSnippet(text: string, terms: string[]): string | null {
  const hits: [number, number][] = [];
  for (const m of text.matchAll(WORD)) {
    const word = comparable(m[0]);
    if (terms.some((t) => word.startsWith(t))) hits.push([m.index, m.index + m[0].length]);
  }
  const first = hits[0];
  if (!first) return null;
  const from = Math.max(0, first[0] - CONTEXT_BEFORE);
  const to = Math.min(text.length, first[0] + CONTEXT_AFTER);
  let out = from > 0 ? "…" : "";
  let cursor = from;
  for (const [start, end] of hits) {
    if (start < from || end > to) continue;
    out += `${escapeHtml(text.slice(cursor, start))}<mark>${escapeHtml(text.slice(start, end))}</mark>`;
    cursor = end;
  }
  return out + escapeHtml(text.slice(cursor, to)) + (to < text.length ? "…" : "");
}

interface BestRow {
  mid: string;
  rank: number;
  text: string;
}

function bestSnippets(
  { db }: RepoContext,
  ids: string[],
  fts: string,
  terms: string[],
): Map<string, string> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const marks = ids.map(() => "?").join(",");
  const segmentRows = db
    .prepare<unknown[], BestRow>(
      `SELECT f.meeting_id AS mid, bm25(segments_fts) AS rank, s.text AS text
         FROM segments_fts f JOIN segments s ON s.rowid = f.rowid
        WHERE segments_fts MATCH ? AND f.meeting_id IN (${marks})`,
    )
    .all(fts, ...ids);
  const translationRows = db
    .prepare<unknown[], BestRow>(
      `SELECT s.meeting_id AS mid, bm25(translations_fts) AS rank, t.text AS text
         FROM translations_fts f
         JOIN translations t ON t.rowid = f.rowid
         JOIN segments s ON s.id = t.segment_id
        WHERE translations_fts MATCH ? AND s.meeting_id IN (${marks})`,
    )
    .all(fts, ...ids);
  const best = new Map<string, number>();
  for (const row of [...segmentRows, ...translationRows]) {
    if (row.rank >= (best.get(row.mid) ?? Infinity)) continue;
    const snippet = buildSnippet(row.text, terms);
    if (snippet === null) continue;
    best.set(row.mid, row.rank);
    out.set(row.mid, snippet);
  }
  return out;
}

const EMPTY_COUNTS = { all: 0, draft: 0, live: 0, ended: 0 };
const EMPTY_TOTALS = { meetings: 0, durationMs: 0, thisWeek: 0, needMinutes: 0 };
const MS_PER_DAY = 86_400_000;

/** Meetings matching title or transcript/translation text (relevance), or all, with filters and sorts. */
export function searchMeetings(
  ctx: RepoContext,
  options: SearchMeetingsOptions = {},
): MeetingSearchResult {
  const hasQuery = (options.q ?? "").trim() !== "";
  const fts = hasQuery ? buildFtsQuery(options.q ?? "") : null;
  if (hasQuery && fts === null)
    return { meetings: [], total: 0, counts: EMPTY_COUNTS, totals: EMPTY_TOTALS };

  const weekFrom =
    options.weekFrom ?? new Date(Date.parse(ctx.now()) - 7 * MS_PER_DAY).toISOString();
  const { rows, total, counts, totals } = queryMeetingList(ctx, options, fts, weekFrom);
  const ids = rows.map((row) => row.id);
  const snippets = fts
    ? bestSnippets(ctx, ids, fts, searchTerms(options.q ?? ""))
    : new Map<string, string>();
  const extras = loadMeetingExtras(ctx, ids);
  const meetings = rows.map((row) => {
    const extra = extras.get(row.id) as MeetingExtras;
    const hit: MeetingSearchHit = {
      ...toMeeting(row),
      ...extra,
      hasMinutes: (["en", "vi"] as MinutesLang[]).filter((lang) => extra.minutes[lang]).sort(),
    };
    const preview = agendaPreview(row.agenda);
    if (preview !== undefined) hit.agendaPreview = preview;
    const snippet = snippets.get(row.id);
    if (snippet !== undefined) hit.snippet = snippet;
    return hit;
  });
  return { meetings, total, counts, totals };
}
