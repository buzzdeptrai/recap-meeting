import type { SourceLang } from "@recap/core";
import type { MeetingStatus, RepoContext } from "../types";
import type { MeetingRow } from "./meetings";
import { minutesStaleSql } from "./minutes-staleness";

export type MinutesFilter = "none" | "vi" | "en" | "stale" | "need";
export type LangFilter = Extract<SourceLang, "vi" | "en" | "multi">;
export type MeetingSort = "newest" | "oldest" | "duration" | "name";

export interface MeetingFilters {
  /** Free text. Empty/blank lists everything. */
  q?: string;
  status?: MeetingStatus;
  /** none = no minutes at all; vi/en = has that language; stale = some minutes need regenerating;
   * need = ended meetings that still need minutes (none, or stale). */
  minutes?: MinutesFilter;
  /** Spoken (source) language of the meeting. */
  lang?: LangFilter;
  /** created_at >= from (ISO instant). */
  from?: string;
  /** created_at < to (ISO instant, exclusive). */
  to?: string;
  /** Default: relevance when `q` is given, else newest first. */
  sort?: MeetingSort;
}

export interface ListQueryOptions extends MeetingFilters {
  limit?: number;
  offset?: number;
  /** Start of "this week" (ISO instant); meetings created at/after it count in `thisWeek`. */
  weekFrom?: string;
}

export interface StatusAggregate {
  meetings: number;
  durationMs: number;
  thisWeek: number;
  needMinutes: number;
}

export type StatusCounts = Record<MeetingStatus | "all", number>;

export interface ListQueryResult {
  rows: MeetingRow[];
  /** Matches before limit/offset (all filters incl. status). */
  total: number;
  /** Per status for every filter EXCEPT status (so chips show what a click would give). */
  counts: StatusCounts;
  /** Aggregates over the current result set (all filters). */
  totals: StatusAggregate;
}

/** Title hits outrank transcript hits of equal strength (bm25: lower is better). */
const TITLE_BOOST = 2;

const MATCHING_MEETINGS = `
  SELECT meeting_id AS mid, bm25(segments_fts) AS rank FROM segments_fts WHERE segments_fts MATCH @fts
  UNION ALL
  SELECT s.meeting_id, bm25(translations_fts) FROM translations_fts
    JOIN translations t ON t.rowid = translations_fts.rowid
    JOIN segments s ON s.id = t.segment_id WHERE translations_fts MATCH @fts
  UNION ALL
  SELECT m.id, bm25(meetings_fts) - ${TITLE_BOOST} FROM meetings_fts
    JOIN meetings m ON m.rowid = meetings_fts.rowid WHERE meetings_fts MATCH @fts`;

/** Per-meeting minutes summary: which languages exist and whether any is stale. */
const MINUTES_STATE = `
  SELECT mi.meeting_id AS meeting_id,
         MAX(mi.lang = 'vi') AS has_vi, MAX(mi.lang = 'en') AS has_en,
         MAX(${minutesStaleSql("mi")}) AS any_stale
    FROM minutes mi GROUP BY mi.meeting_id`;

const NEEDS_MINUTES = "(m.status = 'ended' AND (ms.meeting_id IS NULL OR ms.any_stale = 1))";

const MINUTES_PREDICATE: Record<MinutesFilter, string> = {
  none: "ms.meeting_id IS NULL",
  vi: "ms.has_vi = 1",
  en: "ms.has_en = 1",
  stale: "ms.any_stale = 1",
  need: NEEDS_MINUTES,
};

const ORDER: Record<MeetingSort, string> = {
  newest: "m.created_at DESC, m.rowid DESC",
  oldest: "m.created_at ASC, m.rowid ASC",
  duration: "m.duration_ms DESC NULLS LAST, m.created_at DESC",
  name: "title_key(m.title) ASC, m.title ASC, m.created_at DESC",
};

function conditions(filters: MeetingFilters, withStatus: boolean): string[] {
  const out: string[] = [];
  if (withStatus && filters.status) out.push("m.status = @status");
  if (filters.minutes) out.push(MINUTES_PREDICATE[filters.minutes]);
  if (filters.lang) out.push("m.source_lang = @lang");
  if (filters.from) out.push("m.created_at >= @from");
  if (filters.to) out.push("m.created_at < @to");
  return out;
}

const where = (parts: string[]) => (parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "");

function orderBy(options: ListQueryOptions, hasFts: boolean): string {
  const sort = options.sort ?? (hasFts ? undefined : "newest");
  if (sort === undefined) return "h.rank, m.created_at DESC, m.rowid DESC";
  return ORDER[sort];
}

interface AggregateRow extends StatusAggregate {
  status: MeetingStatus;
}

const emptyAggregate = (): StatusAggregate => ({
  meetings: 0,
  durationMs: 0,
  thisWeek: 0,
  needMinutes: 0,
});

/** Chip counts per status and the totals of the selected status (all statuses when none). */
function summarise(rows: AggregateRow[], selected: MeetingStatus | undefined) {
  const counts: StatusCounts = { all: 0, draft: 0, live: 0, ended: 0 };
  const totals = emptyAggregate();
  for (const row of rows) {
    counts[row.status] = row.meetings;
    counts.all += row.meetings;
    if (selected && row.status !== selected) continue;
    totals.meetings += row.meetings;
    totals.durationMs += row.durationMs;
    totals.thisWeek += row.thisWeek;
    totals.needMinutes += row.needMinutes;
  }
  return { counts, totals };
}

/** Only the named parameters a statement mentions may be bound (better-sqlite3 is strict). */
function bindFor(sql: string, params: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(params).filter(([key]) => sql.includes(`@${key}`)));
}

/**
 * One grouped pass over the filtered set (minus the status filter) gives the chip counts and,
 * summed over the selected status, the totals; a second query fetches the page.
 */
export function queryMeetingList(
  { db }: RepoContext,
  options: ListQueryOptions,
  fts: string | null,
  weekFrom: string,
): ListQueryResult {
  const params = {
    fts,
    status: options.status ?? null,
    lang: options.lang ?? null,
    from: options.from ?? null,
    to: options.to ?? null,
    weekFrom,
    limit: options.limit ?? 50,
    offset: options.offset ?? 0,
  };
  const hits =
    fts === null
      ? ""
      : `, h AS (SELECT mid, MIN(rank) AS rank FROM (${MATCHING_MEETINGS}) GROUP BY mid)`;
  const joinHits = fts === null ? "" : "JOIN h ON h.mid = m.id";
  const prefix = `WITH ms AS (${MINUTES_STATE})${hits}`;
  const from = `FROM meetings m ${joinHits} LEFT JOIN ms ON ms.meeting_id = m.id`;

  const aggSql = `${prefix} SELECT m.status AS status, COUNT(*) AS meetings,
       COALESCE(SUM(m.duration_ms), 0) AS durationMs,
       COALESCE(SUM(m.created_at >= @weekFrom), 0) AS thisWeek,
       COALESCE(SUM(${NEEDS_MINUTES}), 0) AS needMinutes
     ${from} ${where(conditions(options, false))} GROUP BY m.status`;
  const aggregates = db
    .prepare<Record<string, unknown>, AggregateRow>(aggSql)
    .all(bindFor(aggSql, params));
  const { counts, totals } = summarise(aggregates, options.status);

  const pageSql = `${prefix} SELECT m.* ${from} ${where(conditions(options, true))}
      ORDER BY ${orderBy(options, fts !== null)} LIMIT @limit OFFSET @offset`;
  const rows = db
    .prepare<Record<string, unknown>, MeetingRow>(pageSql)
    .all(bindFor(pageSql, params));
  return { rows, total: totals.meetings, counts, totals };
}
