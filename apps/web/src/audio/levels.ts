/** Meter maths: RMS → 0..1 level → lit bars. */

export const METER_BARS = 8;
/** Quietest level shown (dBFS); anything below reads as silence. */
const FLOOR_DB = -60;
/** Per-update smoothing: fast attack, slower release so the meter is readable. */
const RELEASE_FACTOR = 0.82;

export function rmsToLevel(value: number): number {
  if (value <= 0) return 0;
  const db = 20 * Math.log10(value);
  return Math.max(0, Math.min(1, (db - FLOOR_DB) / -FLOOR_DB));
}

/** Instant rise, exponential fall. */
export function smoothLevel(previous: number, next: number): number {
  return next >= previous ? next : previous * RELEASE_FACTOR + next * (1 - RELEASE_FACTOR);
}

/** Number of lit bars (0..bars). Any audible signal lights at least one. */
export function levelToBars(level: number, bars: number = METER_BARS): number {
  if (level <= 0.02) return 0;
  return Math.max(1, Math.min(bars, Math.round(level * bars)));
}

/** Tab audio counts as "silent" when its smoothed level stays under this (≈ -54 dBFS). */
export const SILENCE_LEVEL = 0.1;
