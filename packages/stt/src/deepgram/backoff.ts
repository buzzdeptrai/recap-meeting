import type { ReconnectConfig } from "./config";

const EXPONENT_BASE = 2;
const HALF = 2;

/**
 * Exponential backoff with "equal jitter": half the delay is fixed, half random.
 * `attempt` is 1-based. `random` is injectable for deterministic tests.
 */
export function computeBackoffMs(
  attempt: number,
  config: Pick<ReconnectConfig, "baseDelayMs" | "maxDelayMs">,
  random: () => number = Math.random,
): number {
  const exponential = config.baseDelayMs * EXPONENT_BASE ** Math.max(0, attempt - 1);
  const capped = Math.min(exponential, config.maxDelayMs);
  return Math.round(capped / HALF + (random() * capped) / HALF);
}
