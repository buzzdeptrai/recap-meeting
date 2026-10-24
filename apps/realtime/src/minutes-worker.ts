import type { UsageSink } from "@recap/core";
import type { Repositories } from "@recap/db";
import {
  createMinutesWorker,
  createOpenAiLlmFactory,
  generatorConfigFromEnv,
  minutesWorkerConfigFromEnv,
  type MinutesWorker,
  type OpenAiClientLike,
} from "@recap/minutes";

export interface RealtimeMinutesWorkerOptions {
  repos: Repositories;
  usage: UsageSink;
  /** Env map the worker reads (poll, concurrency, OpenAI key / model, mark window). */
  source: Record<string, string | undefined>;
  /** Injectable OpenAI client (tests). */
  client?: OpenAiClientLike;
  log?: (message: string) => void;
}

/**
 * The minutes worker of this process: DB repositories as the queue, the shared generator config
 * and OpenAI factory from `@recap/minutes`, usage metered through the same sink as translation.
 */
export function createRealtimeMinutesWorker(options: RealtimeMinutesWorkerOptions): MinutesWorker {
  const { repos, source } = options;
  return createMinutesWorker({
    runs: repos.minutesRuns,
    minutes: repos.minutes,
    repos,
    createLlm: createOpenAiLlmFactory(source, options.client),
    usage: options.usage,
    generatorConfig: () => generatorConfigFromEnv(source),
    ...minutesWorkerConfigFromEnv(source),
    log: options.log,
  });
}
