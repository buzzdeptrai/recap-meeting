export const DEFAULT_WORKER_POLL_MS = 1_000;
/** Two runs at once: several users end meetings together, one long run must not block the rest. */
export const DEFAULT_WORKER_CONCURRENCY = 2;
/**
 * A queued run nobody claimed for this long AND no sign of a living worker (no recent running or
 * finished run) means the worker is not running. Waiting behind other runs never counts.
 */
export const DEFAULT_QUEUED_CLAIM_TIMEOUT_MS = 120_000;

type Env = Record<string, string | undefined>;

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export interface MinutesWorkerConfig {
  pollMs: number;
  concurrency: number;
}

/** `MINUTES_WORKER_POLL_MS` / `MINUTES_WORKER_CONCURRENCY`; blank or invalid = default. */
export function minutesWorkerConfigFromEnv(env: Env): MinutesWorkerConfig {
  return {
    pollMs: positiveInt(env.MINUTES_WORKER_POLL_MS, DEFAULT_WORKER_POLL_MS),
    concurrency: positiveInt(env.MINUTES_WORKER_CONCURRENCY, DEFAULT_WORKER_CONCURRENCY),
  };
}

/** `MINUTES_QUEUED_CLAIM_TIMEOUT_MS` overrides how long a queued run may wait for a worker. */
export function queuedClaimTimeoutMsFromEnv(env: Env): number {
  return positiveInt(env.MINUTES_QUEUED_CLAIM_TIMEOUT_MS, DEFAULT_QUEUED_CLAIM_TIMEOUT_MS);
}
