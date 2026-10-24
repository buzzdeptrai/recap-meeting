import type { UsageEventInput, UsageService, UsageVendor } from "@recap/core";
import type { RepoContext } from "../types";

/** Asia/Ho_Chi_Minh (UTC+7) — day buckets default to Vietnam local days. */
export const DEFAULT_TZ_OFFSET_MINUTES = 420;
const DEFAULT_TOP_LIMIT = 10;

export type UsageGroupBy = "day" | "vendor" | "model" | "service" | "meeting";
export type UsageSeriesGroupBy = "vendor" | "model" | "service";

/** `from` inclusive, `to` exclusive; ISO-8601 UTC strings (e.g. 2026-10-01T00:00:00.000Z). */
export interface UsageRange {
  from: string;
  to: string;
}

export interface UsageRecordInput extends UsageEventInput {
  ts?: string;
  costUsd?: number | null;
}

export interface UsageEvent extends UsageEventInput {
  id: string;
  ts: string;
  requests: number;
  costUsd: number | null;
}

export interface UsageSums {
  audioSeconds: number;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  costUsd: number;
  errors: number;
  fallbacks: number;
}

export interface UsageAggregateRow extends UsageSums {
  /** Day (YYYY-MM-DD, local), vendor, model, service or meeting id. */
  key: string;
}

export interface UsageSeriesRow extends UsageSums {
  day: string;
  key: string;
}

export interface UsageAggregateOptions extends UsageRange {
  groupBy: UsageGroupBy;
  vendor?: UsageVendor;
  service?: UsageService;
  tzOffsetMinutes?: number;
}

export interface UsageLatencyRow {
  key: string;
  count: number;
  p50: number;
  p95: number;
}

export interface UsageTopMeeting extends UsageSums {
  meetingId: string;
  title: string | null;
}

export interface UsageReliabilityRow {
  vendor: UsageVendor;
  model: string;
  requests: number;
  errors: number;
  fallbacks: number;
  errorRate: number;
  fallbackRate: number;
}

const SUMS_SQL = `
  COALESCE(SUM(audio_seconds), 0) AS audioSeconds,
  COALESCE(SUM(input_tokens), 0) AS inputTokens,
  COALESCE(SUM(output_tokens), 0) AS outputTokens,
  COALESCE(SUM(requests), 0) AS requests,
  COALESCE(SUM(cost_usd), 0) AS costUsd,
  COALESCE(SUM(CASE WHEN status = 'error' THEN requests ELSE 0 END), 0) AS errors,
  COALESCE(SUM(CASE WHEN status = 'fallback' THEN requests ELSE 0 END), 0) AS fallbacks`;

const EMPTY_SUMS: UsageSums = {
  audioSeconds: 0,
  inputTokens: 0,
  outputTokens: 0,
  requests: 0,
  costUsd: 0,
  errors: 0,
  fallbacks: 0,
};

const dayExpr = (tz: number) => `date(ts, '${Math.trunc(tz)} minutes')`;

const GROUP_COLUMNS: Record<Exclude<UsageGroupBy, "day">, string> = {
  vendor: "vendor",
  model: "model",
  service: "service",
  meeting: "COALESCE(meeting_id, '')",
};

/** Nearest-rank percentile of an ascending array. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1] as number;
}

interface FilterOptions extends UsageRange {
  vendor?: UsageVendor;
  service?: UsageService;
}

function whereClause(options: FilterOptions): { sql: string; params: unknown[] } {
  const parts = ["ts >= ?", "ts < ?"];
  const params: unknown[] = [options.from, options.to];
  if (options.vendor) {
    parts.push("vendor = ?");
    params.push(options.vendor);
  }
  if (options.service) {
    parts.push("service = ?");
    params.push(options.service);
  }
  return { sql: `WHERE ${parts.join(" AND ")}`, params };
}

const msOf = (iso: string) => Date.parse(iso);

function createWriter({ db, now, newId }: RepoContext) {
  // Prepared lazily: repositories can be built over a database that is not yet fully migrated.
  let insertStmt: ReturnType<typeof db.prepare> | undefined;
  const insert = () =>
    (insertStmt ??= db.prepare(
      `INSERT INTO usage_events (id, ts, meeting_id, vendor, service, model, audio_seconds,
       input_tokens, output_tokens, requests, latency_ms, status, cost_usd, meta)
     VALUES (@id, @ts, @meetingId, @vendor, @service, @model, @audioSeconds,
       @inputTokens, @outputTokens, @requests, @latencyMs, @status, @costUsd, @meta)`,
    ));

  function record(input: UsageRecordInput): UsageEvent {
    const event: UsageEvent = {
      ...input,
      id: newId(),
      ts: new Date(input.ts ?? now()).toISOString(),
      requests: input.requests ?? 1,
      costUsd: input.costUsd ?? null,
    };
    insert().run({
      id: event.id,
      ts: event.ts,
      meetingId: input.meetingId ?? null,
      vendor: input.vendor,
      service: input.service,
      model: input.model,
      audioSeconds: input.audioSeconds ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      requests: event.requests,
      latencyMs:
        input.latencyMs === undefined || input.latencyMs === null
          ? null
          : Math.round(input.latencyMs),
      status: input.status,
      costUsd: event.costUsd,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    });
    return event;
  }

  return { record };
}

function createAggregates({ db }: RepoContext) {
  function aggregate(options: UsageAggregateOptions): UsageAggregateRow[] {
    const tz = options.tzOffsetMinutes ?? DEFAULT_TZ_OFFSET_MINUTES;
    const expr = options.groupBy === "day" ? dayExpr(tz) : GROUP_COLUMNS[options.groupBy];
    const { sql, params } = whereClause(options);
    return db
      .prepare<unknown[], UsageAggregateRow>(
        `SELECT ${expr} AS key, ${SUMS_SQL} FROM usage_events ${sql} GROUP BY key ORDER BY key`,
      )
      .all(...params);
  }

  /** Per local day, per vendor/model/service — the data behind a stacked daily chart. */
  function dailySeries(
    options: FilterOptions & { groupBy: UsageSeriesGroupBy; tzOffsetMinutes?: number },
  ): UsageSeriesRow[] {
    const tz = options.tzOffsetMinutes ?? DEFAULT_TZ_OFFSET_MINUTES;
    const { sql, params } = whereClause(options);
    return db
      .prepare<unknown[], UsageSeriesRow>(
        `SELECT ${dayExpr(tz)} AS day, ${GROUP_COLUMNS[options.groupBy]} AS key, ${SUMS_SQL}
         FROM usage_events ${sql} GROUP BY day, key ORDER BY day, key`,
      )
      .all(...params);
  }

  function totals(range: UsageRange & { vendor?: UsageVendor; service?: UsageService }) {
    const { sql, params } = whereClause(range);
    const row = db
      .prepare<unknown[], UsageSums>(`SELECT ${SUMS_SQL} FROM usage_events ${sql}`)
      .get(...params);
    return row ?? { ...EMPTY_SUMS };
  }

  /** Totals of the equally long period right before `range`. */
  function previousPeriodTotals(range: UsageRange): UsageSums {
    const length = msOf(range.to) - msOf(range.from);
    const to = range.from;
    const from = new Date(msOf(range.from) - length).toISOString();
    return totals({ from, to });
  }

  /** Latency of served requests (errors excluded: they time out and skew the picture). */
  return { aggregate, dailySeries, totals, previousPeriodTotals };
}

function createReports({ db }: RepoContext) {
  function latencyPercentiles(range: UsageRange, groupBy: UsageSeriesGroupBy): UsageLatencyRow[] {
    const column = GROUP_COLUMNS[groupBy];
    const rows = db
      .prepare<unknown[], { key: string; latency: number }>(
        `SELECT ${column} AS key, latency_ms AS latency FROM usage_events
         WHERE ts >= ? AND ts < ? AND latency_ms IS NOT NULL AND status != 'error'
         ORDER BY key, latency_ms`,
      )
      .all(range.from, range.to);
    const byKey = new Map<string, number[]>();
    for (const { key, latency } of rows) {
      const list = byKey.get(key) ?? [];
      list.push(latency);
      byKey.set(key, list);
    }
    return [...byKey].map(([key, values]) => ({
      key,
      count: values.length,
      p50: percentile(values, 50),
      p95: percentile(values, 95),
    }));
  }

  return { latencyPercentiles };
}

function createRankings({ db }: RepoContext) {
  function topMeetings(range: UsageRange, limit = DEFAULT_TOP_LIMIT): UsageTopMeeting[] {
    return db
      .prepare<unknown[], UsageTopMeeting>(
        `SELECT meeting_id AS meetingId,
           (SELECT title FROM meetings WHERE id = meeting_id) AS title, ${SUMS_SQL}
         FROM usage_events
         WHERE ts >= ? AND ts < ? AND meeting_id IS NOT NULL
         GROUP BY meeting_id ORDER BY costUsd DESC, audioSeconds DESC, meeting_id LIMIT ?`,
      )
      .all(range.from, range.to, limit);
  }

  function reliability(range: UsageRange): UsageReliabilityRow[] {
    const rows = db
      .prepare<unknown[], { vendor: UsageVendor; model: string } & UsageSums>(
        `SELECT vendor, model, ${SUMS_SQL} FROM usage_events
         WHERE ts >= ? AND ts < ? GROUP BY vendor, model ORDER BY vendor, model`,
      )
      .all(range.from, range.to);
    return rows.map((r) => ({
      vendor: r.vendor,
      model: r.model,
      requests: r.requests,
      errors: r.errors,
      fallbacks: r.fallbacks,
      errorRate: r.requests > 0 ? r.errors / r.requests : 0,
      fallbackRate: r.requests > 0 ? r.fallbacks / r.requests : 0,
    }));
  }

  return { topMeetings, reliability };
}

export function createUsageRepository(context: RepoContext) {
  return {
    ...createWriter(context),
    ...createAggregates(context),
    ...createReports(context),
    ...createRankings(context),
  };
}

export type UsageRepository = ReturnType<typeof createUsageRepository>;
