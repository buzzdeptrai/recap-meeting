/** Scales and "nice" axis ticks for the SVG charts. Non-negative data only. */

export interface NiceAxis {
  /** Top of the axis (a multiple of `step`). */
  max: number;
  step: number;
  /** `0 .. max` inclusive, `intervals + 1` entries. */
  ticks: number[];
}

const STEP_MANTISSAS = [1, 2, 2.5, 5, 10] as const;

/** Smallest "nice" step (1, 2, 2.5, 5 x 10^k) that is >= `rough`. */
export function niceStep(rough: number): number {
  if (!(rough > 0) || !Number.isFinite(rough)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const f = rough / pow;
  const mantissa = STEP_MANTISSAS.find((m) => m >= f - 1e-9) ?? 10;
  return mantissa * pow;
}

/** Axis `0..max` split in a fixed number of intervals so two axes' gridlines align. */
export function niceAxis(dataMax: number, intervals = 4): NiceAxis {
  const n = Math.max(1, Math.floor(intervals));
  const safeMax = dataMax > 0 && Number.isFinite(dataMax) ? dataMax : 1;
  const step = niceStep(safeMax / n);
  const ticks = Array.from({ length: n + 1 }, (_, i) => roundTo(step * i, 10));
  return { max: roundTo(step * n, 10), step, ticks };
}

/** Decimals needed to print every multiple of `step` without collisions (0.05 -> 2, 2 -> 0). */
export function stepDecimals(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 0;
  for (let d = 0; d < 6; d++) {
    const scaled = step * Math.pow(10, d);
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return d;
  }
  return 6;
}

function roundTo(v: number, digits: number): number {
  const p = Math.pow(10, digits);
  return Math.round(v * p) / p;
}

export interface LinearScale {
  (value: number): number;
  domain: readonly [number, number];
  range: readonly [number, number];
}

export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const fn = ((v: number) => r0 + ((v - d0) / span) * (r1 - r0)) as LinearScale;
  fn.domain = domain;
  fn.range = range;
  return fn;
}

export function maxOf(values: readonly number[]): number {
  let max = 0;
  for (const v of values) if (Number.isFinite(v) && v > max) max = v;
  return max;
}

/** Label indices to draw, counted back from the last point so the latest label is always shown. */
export function labelIndices(count: number, plotWidth: number, minGap = 56): number[] {
  if (count <= 0) return [];
  const fit = Math.max(1, Math.floor(plotWidth / minGap));
  const every = Math.max(1, Math.ceil(count / fit));
  const out: number[] = [];
  for (let i = count - 1; i >= 0; i -= every) out.push(i);
  return out.reverse();
}

/** Nearest data index for a pointer x (px, relative to the plot's left edge). */
export function nearestIndex(
  x: number,
  plotWidth: number,
  count: number,
  mode: "point" | "band" = "point",
): number {
  if (count <= 1 || plotWidth <= 0) return 0;
  const t = Math.min(1, Math.max(0, x / plotWidth));
  return mode === "point"
    ? Math.round(t * (count - 1))
    : Math.min(count - 1, Math.floor(t * count));
}

/** Keyboard stepping for chart cursors. Returns the new index, or `null` when the key is not handled. */
export function stepIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  switch (key) {
    case "ArrowLeft":
      return Math.max(0, (current < 0 ? last : current) - 1);
    case "ArrowRight":
      return Math.min(last, current < 0 ? last : current + 1);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}
