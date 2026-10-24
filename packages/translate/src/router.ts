import type { CircuitBreaker } from "./circuit-breaker";
import {
  AllProvidersFailedError,
  ProviderError,
  classifyError,
  type ProviderAttempt,
} from "./errors";
import {
  noopLogger,
  systemClock,
  type Clock,
  type Logger,
  type TranslationProvider,
  type TranslationRequest,
  type UsageHook,
  type TokenUsage,
  type TranslationUsageEvent,
} from "./types";

export interface RouterOptions {
  providers: Record<string, TranslationProvider>;
  /** Preference order; the first entry is the primary. */
  order: readonly string[];
  /** Deadline of the primary (first provider in `order`). */
  deadlineMs: number;
  /** Deadline of fallback providers (2nd and later); defaults to `deadlineMs`. */
  fallbackDeadlineMs?: number;
  /** Extra attempt for providers that only timed out (slow, not dead). 0 disables. */
  slowDeadlineMs: number;
  breaker: CircuitBreaker;
  clock?: Clock;
  logger?: Logger;
  /** Metering hook, called once per provider attempt (success or failure). */
  onUsage?: UsageHook;
}

export interface RouterResult {
  text: string;
  provider: string;
  /** Wall time from router entry to the answer, including failed attempts. */
  latencyMs: number;
  /** True when the answering provider is not the primary. */
  degraded: boolean;
}

export interface RouterStatus {
  provider: string;
  degraded: boolean;
}

export interface Router {
  translate(req: TranslationRequest, options?: { signal?: AbortSignal }): Promise<RouterResult>;
  status(): RouterStatus;
}

export function createRouter(options: RouterOptions): Router {
  // Only TIMEOUT failures get the slow-path retry; 429/402/auth errors fail over without retry.
  const { providers, deadlineMs, slowDeadlineMs, breaker } = options;
  const clock = options.clock ?? systemClock;
  const order = options.order.filter((name) => providers[name]);
  const [first] = order;
  if (!first) throw new Error("Translation router needs at least one configured provider");
  const primary: string = first;
  const fallbackDeadlineMs = options.fallbackDeadlineMs ?? deadlineMs;
  const firstPassDeadline = (name: string) => (name === primary ? deadlineMs : fallbackDeadlineMs);
  let lastAnswered: string | null = null;
  const tryProvider = (name: string, req: TranslationRequest, signal?: AbortSignal, ms = 0) =>
    attempt(options, name, req, signal, ms, primary);

  function finish(name: string, text: string, startedAt: number): RouterResult {
    lastAnswered = name;
    return { text, provider: name, latencyMs: clock.now() - startedAt, degraded: name !== primary };
  }

  async function translate(req: TranslationRequest, opts: { signal?: AbortSignal } = {}) {
    const startedAt = clock.now();
    const attempts: ProviderAttempt[] = [];
    const slowCandidates: string[] = [];

    for (const name of order) {
      throwIfAborted(opts.signal);
      if (!breaker.acquire(name)) {
        attempts.push({ provider: name, code: "BREAKER_OPEN", message: "circuit open" });
        continue;
      }
      const result = await tryProvider(name, req, opts.signal, firstPassDeadline(name));
      if (result.ok) return finish(name, result.text, startedAt);
      attempts.push({ provider: name, code: result.error.code, message: result.error.message });
      if (result.error.code === "TIMEOUT") slowCandidates.push(name);
    }

    for (const name of slowDeadlineMs > 0 ? slowCandidates : []) {
      throwIfAborted(opts.signal);
      const result = await tryProvider(name, req, opts.signal, slowDeadlineMs);
      if (result.ok) return finish(name, result.text, startedAt);
      attempts.push({ provider: name, code: result.error.code, message: result.error.message });
    }
    throw new AllProvidersFailedError(attempts);
  }

  function status(): RouterStatus {
    const usable = order.find((n) => breaker.state(n) !== "open");
    const last = lastAnswered;
    const current = last !== null && breaker.state(last) !== "open" ? last : (usable ?? primary);
    return { provider: current, degraded: current !== primary };
  }

  return { translate, status };
}

function emitUsage(hook: UsageHook | undefined, event: TranslationUsageEvent, log: Logger): void {
  if (!hook) return;
  try {
    hook(event);
  } catch (err) {
    log.warn("usage hook failed", { message: err instanceof Error ? err.message : "unknown" });
  }
}

type AttemptResult = { ok: true; text: string } | { ok: false; error: ProviderError };

async function attempt(
  { providers, breaker, logger = noopLogger, onUsage, clock = systemClock }: RouterOptions,
  name: string,
  req: TranslationRequest,
  signal: AbortSignal | undefined,
  deadlineMs: number,
  primary: string,
): Promise<AttemptResult> {
  const provider = providers[name] as TranslationProvider;
  const startedAt = clock.now();
  const usage = (status: TranslationUsageEvent["status"], tokens?: TokenUsage, code?: string) =>
    emitUsage(
      onUsage,
      {
        ...(req.meetingId ? { meetingId: req.meetingId } : {}),
        provider: name,
        model: provider.model ?? "unknown",
        inputTokens: tokens?.inputTokens ?? null,
        outputTokens: tokens?.outputTokens ?? null,
        latencyMs: Math.max(0, clock.now() - startedAt),
        status,
        ...(code ? { errorCode: code } : {}),
      },
      logger,
    );
  try {
    const out = await provider.translate(req, { signal, deadlineMs });
    if (!out.text.trim())
      throw new ProviderError(`Empty output from ${name}`, "EMPTY_OUTPUT", name);
    breaker.recordSuccess(name);
    usage(name === primary ? "ok" : "fallback", out.usage);
    return { ok: true, text: out.text };
  } catch (err) {
    const error = classifyError(err, name);
    breaker.recordFailure(name, error.code);
    logger.warn("translation provider failed", { provider: name, code: error.code });
    usage("error", undefined, error.code);
    return { ok: false, error };
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new ProviderError("Translation aborted", "ABORTED", "router");
}
