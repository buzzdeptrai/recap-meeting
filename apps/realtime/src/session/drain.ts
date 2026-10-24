/** Max time `stop()` waits for in-flight translations before ending the meeting anyway. */
export const DRAIN_TIMEOUT_MS = 4_000;

/** Waits for in-flight hook work, but never longer than `timeoutMs`. */
export async function waitBounded(
  work: Promise<void> | undefined,
  timeoutMs: number = DRAIN_TIMEOUT_MS,
): Promise<void> {
  if (!work) return;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  try {
    await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
