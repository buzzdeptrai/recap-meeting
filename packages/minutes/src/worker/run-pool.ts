import { executeRun } from "./execute";
import { RESTART_RUN_ERROR } from "./messages";
import type { MinutesWorkerDeps } from "./types";

/** The runs this process is executing right now, bounded by the concurrency limit. */
export function createRunPool(deps: MinutesWorkerDeps, log: (message: string) => void) {
  const inFlight = new Map<string, Promise<void>>();
  let stopped = false;

  const claimNext = () => {
    try {
      return deps.runs.claimNext();
    } catch (err) {
      log(`[minutes-worker] claim failed: ${err instanceof Error ? err.name : "unknown"}`);
      return undefined;
    }
  };

  return {
    size: () => inFlight.size,
    /** Claims queued runs up to the concurrency limit; returns how many were started. */
    tick(): number {
      let claimed = 0;
      while (!stopped && inFlight.size < deps.concurrency) {
        const run = claimNext();
        if (!run) break;
        const job = executeRun(deps, run, () => stopped, log).finally(() =>
          inFlight.delete(run.id),
        );
        inFlight.set(run.id, job);
        claimed += 1;
      }
      return claimed;
    },
    /** Stops claiming and fails what is in flight; their late writes become no-ops. */
    stop(): void {
      stopped = true;
      for (const id of inFlight.keys()) {
        try {
          deps.runs.fail(id, RESTART_RUN_ERROR);
        } catch {
          // the next boot's recovery fails whatever is left running
        }
      }
    },
    async whenIdle(): Promise<void> {
      while (inFlight.size > 0) await Promise.allSettled([...inFlight.values()]);
    },
  };
}
