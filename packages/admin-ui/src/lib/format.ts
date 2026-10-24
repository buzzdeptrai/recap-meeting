/** vi-VN number formatting helpers: `1.234,5`, compact `6,59 triệu`, USD, durations, deltas. */

const LOCALE = "vi-VN";

export type DeltaDirection = "up" | "down" | "flat";

export interface DeltaInfo {
  /** Display text, e.g. `+18,8%`. */
  text: string;
  direction: DeltaDirection;
}

const cache = new Map<string, Intl.NumberFormat>();

function nf(min: number, max: number): Intl.NumberFormat {
  const key = `${min}:${max}`;
  let fmt = cache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: min, maximumFractionDigits: max });
    cache.set(key, fmt);
  }
  return fmt;
}

/** `formatNumber(1234.5, 1)` -> `1.234,5`. `decimals` is the max; use `fixed` to force trailing zeros. */
export function formatNumber(value: number, decimals = 0, fixed = false): string {
  if (!Number.isFinite(value)) return "–";
  return nf(fixed ? decimals : 0, decimals).format(value);
}

const COMPACT_UNITS: ReadonlyArray<readonly [number, string]> = [
  [1e9, "tỷ"],
  [1e6, "triệu"],
  [1e3, "nghìn"],
];

/** Three significant digits, no trailing zeros: `6590000` -> `6,59 triệu`, `12300` -> `12,3 nghìn`. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  const unit = COMPACT_UNITS.find(([size]) => abs >= size);
  if (!unit) return formatNumber(value, abs < 100 ? 1 : 0);
  const scaled = value / unit[0];
  const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
  return `${formatNumber(scaled, digits)} ${unit[1]}`;
}

/** `formatUsd(41.87)` -> `$41,87`. Sub-cent amounts keep 4 decimals so they do not read as `$0,00`. */
export function formatUsd(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  const digits = abs > 0 && abs < 0.01 ? 4 : decimals;
  return `${value < 0 ? "-" : ""}$${nf(digits, digits).format(abs)}`;
}

/** Short money for axes: `$4,5`, `$6`. */
export function formatUsdAxis(value: number): string {
  return `$${formatNumber(value, 2)}`;
}

/** `formatPercent(18.8, { sign: true })` -> `+18,8%`. Input is already a percentage (not a ratio). */
export function formatPercent(
  percent: number,
  opts: { decimals?: number; sign?: boolean } = {},
): string {
  if (!Number.isFinite(percent)) return "–";
  const { decimals = 1, sign = false } = opts;
  const text = `${formatNumber(percent, decimals)}%`;
  return sign && percent > 0 ? `+${text}` : text;
}

/** Relative change vs a previous period. A zero/absent baseline yields `null` (nothing sensible to show). */
export function formatDelta(current: number, previous: number, decimals = 1): DeltaInfo | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Number(pct.toFixed(decimals));
  const direction: DeltaDirection = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  return { text: formatPercent(rounded, { decimals, sign: true }), direction };
}

export type DurationStyle = "long" | "clock";

/**
 * `long`: `79 giờ 12 phút`, `24 phút 05 giây`, `45 giây`. `clock`: `01:07:42`.
 * Negative / non-finite input renders as `–`.
 */
export function formatDuration(totalSeconds: number, style: DurationStyle = "long"): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "–";
  const total = Math.round(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  if (style === "clock") return `${two(h)}:${two(m)}:${two(s)}`;
  if (h > 0) return `${formatNumber(h)} giờ ${two(m)} phút`;
  if (m > 0) return `${m} phút ${two(s)} giây`;
  return `${s} giây`;
}

/** Latency: `412 ms`, `2,4 s`. */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "–";
  return ms >= 1000 ? `${formatNumber(ms / 1000, 1)} s` : `${formatNumber(Math.round(ms))} ms`;
}
