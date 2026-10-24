import { RESTART_RUN_ERROR } from "./messages";
import { createRunPool } from "./run-pool";
import type { MinutesWorker, MinutesWorkerDeps } from "./types";

/**
 * Background executor for queued minutes runs. It lives in a long-lived process (apps/realtime);
 * the web app only enqueues. Claiming is one conditional UPDATE, so several workers (or
 * processes) can poll the same database and never run the same row.
 */
export function createMinutesWorker(deps: MinutesWorkerDeps): MinutesWorker {
  const log = deps.log ?? ((message: string) => console.log(message));
  const pool = createRunPool(deps, log);
  let started = false;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  function schedule() {
    if (stopped) return;
    timer = setTimeout(() => {
      pool.tick();
      schedule();
    }, deps.pollMs);
    timer.unref();
  }

  function recoverOnStartup(): number {
    const count = deps.runs.failRunning(RESTART_RUN_ERROR);
    if (count > 0) log(`[minutes-worker] recovered ${count} interrupted run(s)`);
    return count;
  }

  return {
    tick: pool.tick,
    recoverOnStartup,
    whenIdle: pool.whenIdle,
    start() {
      if (started || stopped) return;
      started = true;
      recoverOnStartup();
      log(
        `[minutes-worker] minutes worker started (poll ${deps.pollMs} ms, concurrency ${deps.concurrency})`,
      );
      pool.tick();
      schedule();
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      pool.stop();
    },
    status: () => ({ running: started && !stopped, pollMs: deps.pollMs, inFlight: pool.size() }),
  };
}
