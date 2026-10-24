import {
  breakdownQuerySchema,
  meetingsQuerySchema,
  reliabilityQuerySchema,
  seriesQuerySchema,
  summaryQuerySchema,
} from "@/server/usage-range";
import {
  getBreakdown,
  getReliability,
  getSeries,
  getSummary,
  getTopMeetings,
  type UsageServiceDeps,
} from "@/server/usage-service";
import { rangeParams, type UsageViewState } from "./usage-url";

export type UsageSummary = ReturnType<typeof getSummary>;
export type UsageSeries = ReturnType<typeof getSeries>;
export type UsageBreakdown = ReturnType<typeof getBreakdown>;
export type UsageReliability = ReturnType<typeof getReliability>;
export type UsageTopMeetings = ReturnType<typeof getTopMeetings>;

export interface UsagePageData {
  summary: UsageSummary;
  series: UsageSeries;
  breakdown: UsageBreakdown;
  reliability: UsageReliability;
  meetings: UsageTopMeetings;
}

const TOP_MEETINGS = 8;

/** Wall clock for pages (kept out of components so render stays pure). */
export const nowMs = (): number => Date.now();

/** Same normalisation as the REST routes: schema in, typed query out. */
function parsed<T>(schema: { parse: (v: unknown) => T }, raw: Record<string, string>): T {
  return schema.parse(raw);
}

/** Everything `/usage` shows, straight from the services (no HTTP hop). Throws on invalid range. */
export function loadUsagePage(
  state: UsageViewState,
  nowMs: number,
  deps?: UsageServiceDeps,
): UsagePageData {
  const range = rangeParams(state, nowMs);
  return {
    summary: getSummary(parsed(summaryQuerySchema, range), deps),
    series: getSeries(
      parsed(seriesQuerySchema, { ...range, metric: state.metric, groupBy: state.group }),
      deps,
    ),
    breakdown: getBreakdown(parsed(breakdownQuerySchema, { ...range, groupBy: state.group }), deps),
    reliability: getReliability(parsed(reliabilityQuerySchema, range), deps),
    meetings: getTopMeetings(
      parsed(meetingsQuerySchema, { ...range, limit: String(TOP_MEETINGS) }),
      deps,
    ),
  };
}

/** True when nothing was recorded in the selected range. */
export function isEmptyUsage(summary: UsageSummary): boolean {
  return summary.totals.requests === 0 && summary.totals.audioSeconds === 0;
}
