/**
 * Bounded retry for transient LLM failures (HTTP 429, 5xx, dropped connections) so one rate-limit
 * answer in the middle of a long map-reduce does not fail the whole run. Used by the minutes
 * path only; live translation intentionally fails over to the next provider instead.
 */

/** Total tries per model call (first try included). */
export const LLM_MAX_ATTEMPTS = 4;
/** Delay before the first retry; doubles each time (1 s, 2 s, 4 s). */
export const LLM_RETRY_BASE_DELAY_MS = 1_000;
/** No single wait (computed or Retry-After) exceeds this. */
export const LLM_RETRY_MAX_DELAY_MS = 30_000;
/** Random extra wait, as a fraction of the delay, so parallel runs do not retry in lockstep. */
export const LLM_RETRY_JITTER_RATIO = 0.25;

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_MIN = 500;
const MS_PER_SECOND = 1_000;
/** Node / undici error codes for a connection that broke before an answer came. */
const NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  /** Seam for tests. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  /** Epoch ms, only to read an HTTP-date Retry-After. */
  now?: () => number;
}

interface ErrorLike {
  status?: unknown;
  code?: unknown;
  name?: unknown;
  headers?: unknown;
  cause?: unknown;
}

const asErrorLike = (err: unknown): ErrorLike => (typeof err === "object" && err ? err : {});

/** 429, any 5xx, or a network-level failure. Never a 4xx the request itself caused. */
export function isRetryableLlmError(err: unknown): boolean {
  const { status, code, name, cause } = asErrorLike(err);
  if (typeof status === "number") {
    return status === HTTP_TOO_MANY_REQUESTS || status >= HTTP_SERVER_ERROR_MIN;
  }
  if (name === "APIConnectionError") return true;
  if (typeof code === "string" && NETWORK_ERROR_CODES.has(code)) return true;
  return cause !== undefined && cause !== err && isRetryableLlmError(cause);
}

function readHeader(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== "object") return undefined;
  const maybeGet = (headers as { get?: unknown }).get;
  if (typeof maybeGet === "function") {
    const value: unknown = maybeGet.call(headers, name);
    return typeof value === "string" ? value : undefined;
  }
  const value = (headers as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
}

/** `Retry-After` in ms (delta-seconds or HTTP-date), or undefined when absent/unusable. */
export function retryAfterMs(err: unknown, now: number): number | undefined {
  const raw = readHeader(asErrorLike(err).headers, "retry-after")?.trim();
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * MS_PER_SECOND;
  const date = Date.parse(raw);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `attempt`; on a retryable error waits (Retry-After or backoff + jitter) and tries again. */
export async function withLlmRetry<T>(
  attempt: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? LLM_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? LLM_RETRY_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? LLM_RETRY_MAX_DELAY_MS;
  const jitterRatio = options.jitterRatio ?? LLM_RETRY_JITTER_RATIO;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
  for (let tries = 1; ; tries++) {
    try {
      return await attempt();
    } catch (err) {
      if (tries >= maxAttempts || !isRetryableLlmError(err)) throw err;
      const backoff = baseDelayMs * 2 ** (tries - 1);
      const hinted = retryAfterMs(err, now());
      const wait = hinted ?? backoff * (1 + jitterRatio * random());
      await sleep(Math.min(maxDelayMs, wait));
    }
  }
}
