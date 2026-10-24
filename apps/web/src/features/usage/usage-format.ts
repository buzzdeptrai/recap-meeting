import {
  formatCompact,
  formatDuration,
  formatNumber,
  formatUsd,
  formatUsdAxis,
} from "@recap/admin-ui";
import { localDate } from "./usage-url";
import type { MetricKey } from "./usage-url";

const SECONDS_PER_HOUR = 3600;

/** "2026-10-07" -> "7/10". */
export function dayLabel(day: string): string {
  const [, month, date] = day.split("-");
  return `${Number(date)}/${Number(month)}`;
}

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** "01/10 – 22/10/2026" for an ISO range whose `to` is exclusive. */
export function rangeLabel(range: { from: string; to: string; tzOffsetMinutes: number }): string {
  const tz = range.tzOffsetMinutes;
  const start = localDate(Date.parse(range.from), tz);
  const end = localDate(Date.parse(range.to) - 1, tz);
  const year = end.slice(0, 4);
  return start === end ? `${ddmm(end)}/${year}` : `${ddmm(start)} – ${ddmm(end)}/${year}`;
}

export interface MetricFormat {
  /** Tooltip, table and headline. */
  value: (v: number) => string;
  /** Short y-axis tick. */
  axis: (v: number) => string;
}

const hours = (s: number) => formatNumber(s / SECONDS_PER_HOUR, 1);

export function metricFormat(metric: MetricKey): MetricFormat {
  switch (metric) {
    case "cost":
      return { value: formatUsd, axis: formatUsdAxis };
    case "seconds":
      return { value: (v) => formatDuration(v), axis: (v) => `${hours(v)} g` };
    case "tokens":
      return { value: formatCompact, axis: formatCompact };
    case "requests":
      return { value: (v) => formatNumber(v), axis: (v) => formatNumber(v) };
  }
}

export function metricTitle(metric: MetricKey, estimated: boolean): string {
  switch (metric) {
    case "cost":
      return estimated ? "Chi phí (ví dụ)" : "Chi phí ước tính";
    case "seconds":
      return "Thời lượng chép lời (giờ kênh)";
    case "tokens":
      return "Token LLM";
    case "requests":
      return "Lượt gọi";
  }
}
