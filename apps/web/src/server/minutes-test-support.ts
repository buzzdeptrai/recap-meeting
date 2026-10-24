import type { MinutesLang } from "@recap/core";
import type { Repositories } from "@recap/db";
import {
  createMinutesWorker,
  type LlmFactory,
  type MinutesWorker,
  type MinutesWorkerDeps,
} from "@recap/minutes";

/** Test helper: a worker over the given repositories, with a fake model and no metering. */
export function testWorker(
  repos: Repositories,
  createLlm: LlmFactory,
  over: Partial<MinutesWorkerDeps> = {},
): MinutesWorker {
  return createMinutesWorker({
    runs: repos.minutesRuns,
    minutes: repos.minutes,
    repos,
    createLlm,
    usage: () => {},
    pollMs: 10,
    concurrency: 1,
    log: () => {},
    ...over,
  });
}

/** Test helper: enqueue + run one generation to completion, as web + realtime do together. */
export async function generateNow(
  repos: Repositories,
  meetingId: string,
  lang: MinutesLang,
  createLlm: LlmFactory,
): Promise<void> {
  repos.minutesRuns.start({ meetingId, lang });
  const worker = testWorker(repos, createLlm);
  worker.tick();
  await worker.whenIdle();
}
