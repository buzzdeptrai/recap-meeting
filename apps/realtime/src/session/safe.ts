/** Logs a session problem without throwing (one prefix for every session log line). */
export const log = (message: string, error?: unknown): void =>
  console.error(`[session] ${message}`, error instanceof Error ? error.message : (error ?? ""));

/** Runs async cleanup; a failure is logged and swallowed so the remaining steps still run. */
export async function safely(label: string, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    log(`failed to ${label}`, error);
  }
}

/** Sync counterpart of `safely`. */
export function safelySync(label: string, action: () => void): void {
  try {
    action();
  } catch (error) {
    log(`failed: ${label}`, error);
  }
}
