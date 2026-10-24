import { ProviderError } from "../errors";

/**
 * Runs `fn` with an AbortSignal that fires when `deadlineMs` elapses or `outer` aborts.
 * The returned promise also rejects on abort, so SDKs that ignore the signal cannot overrun.
 */
export async function runWithDeadline<T>(
  provider: string,
  deadlineMs: number,
  outer: AbortSignal | undefined,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deadlineMs);
  const onOuterAbort = () => controller.abort();
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener("abort", onOuterAbort, { once: true });

  const aborted = new Promise<never>((_, reject) => {
    const fail = () =>
      reject(
        timedOut
          ? new ProviderError(`${provider} exceeded ${deadlineMs}ms deadline`, "TIMEOUT", provider)
          : new ProviderError(`${provider} call aborted`, "ABORTED", provider),
      );
    if (controller.signal.aborted) fail();
    else controller.signal.addEventListener("abort", fail, { once: true });
  });

  try {
    return await Promise.race([fn(controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onOuterAbort);
    // Swallow the losing `aborted` rejection if fn finished first and we abort in cleanup.
    aborted.catch(() => undefined);
  }
}
