/**
 * Display-only multiplier for every money number shown to users. Server-only: the value is read
 * from `USAGE_COST_DISPLAY_MULTIPLIER`, never exposed to the browser, an API or the UI. The DB
 * keeps the real costs.
 */
const DEFAULT_MULTIPLIER = 1;

export function costDisplayMultiplier(env: Record<string, string | undefined> = process.env) {
  const raw = Number(env.USAGE_COST_DISPLAY_MULTIPLIER);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MULTIPLIER;
}

/** Scales a real money amount (USD) for display. */
export function scaleCost(value: number, multiplier: number = costDisplayMultiplier()): number {
  return value * multiplier;
}

/** True when displayed money differs from the real figure (free-text that quotes real prices must be hidden). */
export const isCostScaled = (multiplier: number = costDisplayMultiplier()) =>
  multiplier !== DEFAULT_MULTIPLIER;
