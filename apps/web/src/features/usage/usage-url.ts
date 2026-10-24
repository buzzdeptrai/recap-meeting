/** URL-driven state of `/usage`: `?range=&group=&metric=` (+ optional `tz`). Defaults are omitted. */
export const RANGES = ["month", "7d", "30d"] as const;
export const GROUPS = ["vendor", "model", "service"] as const;
export const METRICS = ["cost", "seconds", "tokens", "requests"] as const;

export type RangeKey = (typeof RANGES)[number];
export type GroupKey = (typeof GROUPS)[number];
export type MetricKey = (typeof METRICS)[number];

export interface UsageViewState {
  range: RangeKey;
  group: GroupKey;
  metric: MetricKey;
  /** Minutes east of UTC, as in the REST contract. */
  tz: number;
}

/** Asia/Ho_Chi_Minh, the REST default. Client-safe: this module must not import server code. */
const DEFAULT_TZ_MINUTES = 420;
const MAX_TZ_MINUTES = 14 * 60;

export const DEFAULT_STATE: UsageViewState = {
  range: "month",
  group: "vendor",
  metric: "cost",
  tz: DEFAULT_TZ_MINUTES,
};

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const RANGE_DAYS: Record<Exclude<RangeKey, "month">, number> = { "7d": 7, "30d": 30 };

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function pick<T extends string>(allowed: readonly T[], raw: string | undefined, fallback: T): T {
  return allowed.find((a) => a === raw) ?? fallback;
}

/** `tz` in the page URL is whole minutes east of UTC ("420"); anything else falls back to default. */
export function parseTzMinutes(raw: string | undefined): number | null {
  if (raw === undefined || !/^-?\d{1,4}$/.test(raw)) return null;
  const minutes = Number(raw);
  return Math.abs(minutes) <= MAX_TZ_MINUTES ? minutes : null;
}

export function parseUsageState(params: RawParams): UsageViewState {
  const rawTz = first(params.tz);
  const tz = parseTzMinutes(rawTz);
  return {
    range: pick(RANGES, first(params.range), DEFAULT_STATE.range),
    group: pick(GROUPS, first(params.group), DEFAULT_STATE.group),
    metric: pick(METRICS, first(params.metric), DEFAULT_STATE.metric),
    tz: tz ?? DEFAULT_STATE.tz,
  };
}

/** Linkable `/usage` URL for a state (only non-default values appear). */
export function usageHref(state: UsageViewState): string {
  const params = new URLSearchParams();
  if (state.range !== DEFAULT_STATE.range) params.set("range", state.range);
  if (state.group !== DEFAULT_STATE.group) params.set("group", state.group);
  if (state.metric !== DEFAULT_STATE.metric) params.set("metric", state.metric);
  if (state.tz !== DEFAULT_STATE.tz) params.set("tz", String(state.tz));
  const query = params.toString();
  return query ? `/usage?${query}` : "/usage";
}

/** Local calendar date (YYYY-MM-DD) of an instant at the given UTC offset. */
export function localDate(ms: number, tz: number): string {
  return new Date(ms + tz * MS_PER_MINUTE).toISOString().slice(0, 10);
}

/**
 * `from`/`to`/`tz` query values for the usage REST endpoints: local dates, `to` inclusive. "Tháng
 * này" runs from the 1st of the current local month to today; 7/30 days end today.
 */
export function rangeParams(state: UsageViewState, nowMs: number): Record<string, string> {
  const tz = String(state.tz);
  const to = localDate(nowMs, state.tz);
  if (state.range === "month") return { from: `${to.slice(0, 7)}-01`, to, tz };
  const days = RANGE_DAYS[state.range];
  return { from: localDate(nowMs - (days - 1) * MS_PER_DAY, state.tz), to, tz };
}

export function exportHref(state: UsageViewState, nowMs: number, groupBy = "day"): string {
  const params = new URLSearchParams({ ...rangeParams(state, nowMs), groupBy });
  return `/api/usage/export.csv?${params.toString()}`;
}

export const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "7 ngày",
  "30d": "30 ngày",
  month: "Tháng này",
};
export const GROUP_LABELS: Record<GroupKey, string> = {
  vendor: "Nhà cung cấp",
  model: "Model",
  service: "Dịch vụ",
};
export const METRIC_LABELS: Record<MetricKey, string> = {
  cost: "Chi phí",
  seconds: "Giây chép lời",
  tokens: "Token",
  requests: "Lượt gọi",
};
