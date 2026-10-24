import { DAY_MS, vnDayKey, vnDayStart, vnMonthStart } from "@/lib/vn-time";
import type { RangeValue } from "@/lib/list-query";

export interface ResolvedRange {
  /** created_at >= from (ISO instant). */
  from?: string;
  /** created_at < to (ISO instant, exclusive). */
  to?: string;
}

const iso = (ms: number) => new Date(ms).toISOString();

export interface RangeInput {
  range?: RangeValue;
  /** `YYYY-MM-DD` Vietnam day, inclusive (used when `range` is `custom` or omitted). */
  from?: string;
  to?: string;
}

/**
 * Turns the `range` / `from` / `to` query into instants using Vietnam calendar days.
 * Presets: today = since 00:00 today; 7d / 30d = today and the 6 / 29 days before it; month = since the 1st.
 * `from` / `to` alone imply `custom`; `to` is a whole inclusive day.
 */
export function resolveRange(input: RangeInput, now: number): ResolvedRange {
  const todayStart = vnDayStart(vnDayKey(now));
  const range = input.range ?? (input.from || input.to ? "custom" : "all");
  switch (range) {
    case "today":
      return { from: iso(todayStart) };
    case "7d":
      return { from: iso(todayStart - 6 * DAY_MS) };
    case "30d":
      return { from: iso(todayStart - 29 * DAY_MS) };
    case "month":
      return { from: iso(vnMonthStart(now)) };
    case "custom": {
      const out: ResolvedRange = {};
      const from = input.from ? vnDayStart(input.from) : Number.NaN;
      const to = input.to ? vnDayStart(input.to) : Number.NaN;
      if (!Number.isNaN(from)) out.from = iso(from);
      if (!Number.isNaN(to)) out.to = iso(to + DAY_MS);
      return out;
    }
    default:
      return {};
  }
}
