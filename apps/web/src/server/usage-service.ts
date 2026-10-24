import type { Pricing } from "@recap/core";
import type { Repositories, UsageSums } from "@recap/db";
import { getRepositories } from "./db";
import {
  dayKeys,
  startOfLocalMonth,
  type BreakdownQuery,
  type ExportQuery,
  type MeetingsQuery,
  type SeriesQuery,
  type UsageRangeQuery,
} from "./usage-range";
import { getPricing } from "./usage-recorder";

const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;
const DEFAULT_BUDGET_USD = 60;
const UNASSIGNED = "";

export interface UsageServiceDeps {
  repos: Pick<Repositories, "usage" | "meetings">;
  pricing: Pricing;
  now: () => number;
  budgetUsd: number;
}

function defaultDeps(): UsageServiceDeps {
  const raw = Number(process.env.USAGE_MONTHLY_BUDGET_USD);
  return {
    repos: getRepositories(),
    pricing: getPricing(),
    now: Date.now,
    budgetUsd: Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_BUDGET_USD,
  };
}

const rangeOf = (q: UsageRangeQuery) => ({ from: q.from, to: q.to });
const echo = (q: UsageRangeQuery) => ({
  from: q.from,
  to: q.to,
  tzOffsetMinutes: q.tzOffsetMinutes,
});

/** Percentage change vs the previous period; null when there is nothing to compare with. */
function pctChange(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

const tokensOf = (s: Pick<UsageSums, "inputTokens" | "outputTokens">) =>
  s.inputTokens + s.outputTokens;

export function getSummary(query: UsageRangeQuery, deps: UsageServiceDeps = defaultDeps()) {
  const { usage } = deps.repos;
  const totals = usage.totals(rangeOf(query));
  const previous = usage.previousPeriodTotals(rangeOf(query));
  return {
    range: echo(query),
    totals,
    previous,
    deltasPct: {
      costUsd: pctChange(totals.costUsd, previous.costUsd),
      audioSeconds: pctChange(totals.audioSeconds, previous.audioSeconds),
      tokens: pctChange(tokensOf(totals), tokensOf(previous)),
      requests: pctChange(totals.requests, previous.requests),
    },
    budget: monthBudget(query.tzOffsetMinutes, deps),
    pricing: pricingStatus(deps.pricing),
  };
}

/** Spend of the current local calendar month (independent of the selected range). */
function monthBudget(tz: number, deps: UsageServiceDeps) {
  const nowMs = deps.now();
  const startMs = startOfLocalMonth(nowMs, tz);
  const local = new Date(nowMs + tz * MS_PER_MINUTE);
  const daysInMonth = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const spentUsd = deps.repos.usage.totals({
    from: new Date(startMs).toISOString(),
    to: new Date(nowMs + 1).toISOString(),
  }).costUsd;
  // At least one day of history so the first hours of a month do not extrapolate wildly.
  const daysElapsed = Math.max(1, (nowMs - startMs) / MS_PER_DAY);
  return {
    monthlyUsd: deps.budgetUsd,
    month: local.toISOString().slice(0, 7),
    spentUsd,
    projectedUsd: (spentUsd / daysElapsed) * daysInMonth,
    percentUsed: (spentUsd / deps.budgetUsd) * 100,
    daysElapsed,
    daysInMonth,
  };
}

function pricingStatus(pricing: Pricing) {
  const entries = pricing.entries;
  return {
    allVerified: entries.length > 0 && entries.every((e) => e.verified),
    unverified: entries.filter((e) => !e.verified).map((e) => `${e.vendor}/${e.model}`),
    updatedAt:
      entries
        .map((e) => e.updated_at)
        .sort()
        .at(-1) ?? null,
  };
}

const METRIC_VALUE: Record<SeriesQuery["metric"], (s: UsageSums) => number> = {
  cost: (s) => s.costUsd,
  seconds: (s) => s.audioSeconds,
  tokens: tokensOf,
  requests: (s) => s.requests,
};

export function getSeries(query: SeriesQuery, deps: UsageServiceDeps = defaultDeps()) {
  const rows = deps.repos.usage.dailySeries({
    ...rangeOf(query),
    groupBy: query.groupBy,
    tzOffsetMinutes: query.tzOffsetMinutes,
  });
  const days = dayKeys(query);
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const value = METRIC_VALUE[query.metric];
  const byKey = new Map<string, number[]>();
  for (const row of rows) {
    const index = dayIndex.get(row.day);
    if (index === undefined) continue;
    const values = byKey.get(row.key) ?? days.map(() => 0);
    values[index] = (values[index] ?? 0) + value(row);
    byKey.set(row.key, values);
  }
  const series = [...byKey]
    .map(([key, values]) => ({ key, values, total: values.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);
  return {
    range: echo(query),
    metric: query.metric,
    groupBy: query.groupBy,
    days,
    series,
    dayTotals: days.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)),
  };
}

export function getBreakdown(query: BreakdownQuery, deps: UsageServiceDeps = defaultDeps()) {
  const rows = deps.repos.usage.aggregate({ ...rangeOf(query), groupBy: query.groupBy });
  const totalCost = rows.reduce((sum, r) => sum + r.costUsd, 0);
  const titles = query.groupBy === "meeting" ? meetingTitles(deps) : new Map<string, string>();
  return {
    range: echo(query),
    groupBy: query.groupBy,
    rows: rows
      .map((r) => ({
        ...r,
        label: query.groupBy === "meeting" ? (titles.get(r.key) ?? null) : r.key,
        key: r.key === UNASSIGNED ? null : r.key,
        costShare: totalCost > 0 ? r.costUsd / totalCost : 0,
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
  };
}

function meetingTitles(deps: UsageServiceDeps): Map<string, string> {
  return new Map(deps.repos.meetings.list({ limit: 10_000 }).map((m) => [m.id, m.title]));
}

export function getReliability(query: UsageRangeQuery, deps: UsageServiceDeps = defaultDeps()) {
  const { usage } = deps.repos;
  const latency = new Map(usage.latencyPercentiles(rangeOf(query), "model").map((l) => [l.key, l]));
  return {
    range: echo(query),
    rows: usage.reliability(rangeOf(query)).map((r) => {
      const l = latency.get(r.model);
      return {
        ...r,
        latency: { count: l?.count ?? 0, p50Ms: l?.p50 ?? null, p95Ms: l?.p95 ?? null },
      };
    }),
  };
}

export function getTopMeetings(query: MeetingsQuery, deps: UsageServiceDeps = defaultDeps()) {
  return {
    range: echo(query),
    meetings: deps.repos.usage.topMeetings(rangeOf(query), query.limit),
  };
}

const CSV_COLUMNS = [
  "key",
  "label",
  "cost_usd",
  "audio_seconds",
  "input_tokens",
  "output_tokens",
  "requests",
  "errors",
  "fallbacks",
] as const;

/** Quotes a cell and neutralises spreadsheet formula injection (= + - @ prefixes). */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function getCsv(query: ExportQuery, deps: UsageServiceDeps = defaultDeps()): string {
  const { rows } =
    query.groupBy === "day"
      ? {
          rows: deps.repos.usage
            .aggregate({
              ...rangeOf(query),
              groupBy: "day",
              tzOffsetMinutes: query.tzOffsetMinutes,
            })
            .map((r) => ({ ...r, label: r.key })),
        }
      : getBreakdown({ ...query, groupBy: query.groupBy }, deps);
  const lines = rows.map((r) =>
    [
      r.key ?? "",
      r.label ?? "",
      r.costUsd,
      r.audioSeconds,
      r.inputTokens,
      r.outputTokens,
      r.requests,
      r.errors,
      r.fallbacks,
    ]
      .map(csvCell)
      .join(","),
  );
  return [CSV_COLUMNS.join(","), ...lines].join("\n") + "\n";
}

/** True when every configured price is verified (the list labels per-meeting costs "ví dụ" otherwise). */
export function arePricesVerified(deps: UsageServiceDeps = defaultDeps()): boolean {
  return pricingStatus(deps.pricing).allVerified;
}
