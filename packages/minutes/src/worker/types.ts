import type { UsageSink } from "@recap/core";
import type { MinutesLang } from "@recap/core";
import type { MinutesRun, StartRunInput, StoredMinutes, UpsertMinutesInput } from "@recap/db";
import type {
  GeneratorConfig,
  MinutesLlm,
  MinutesProgress,
  MinutesRepos,
  MinutesUsageHook,
} from "../types";

/** Queue of generation runs. `Repositories["minutesRuns"]` satisfies it. */
export interface RunStore {
  /** Atomically takes the oldest queued run (marking it running); undefined when none. */
  claimNext(): MinutesRun | undefined;
  /** Queues a run (or returns the active one for the same meeting + language). */
  start(input: StartRunInput): { run: MinutesRun; created: boolean };
  updateProgress(id: string, progress: MinutesProgress): boolean;
  finish(id: string): boolean;
  fail(id: string, error: string): boolean;
  /** Fails every run still marked running (startup recovery); returns how many. */
  failRunning(error: string): number;
}

/** Where generated minutes are written. `Repositories["minutes"]` satisfies it. */
export interface MinutesStore {
  upsert(input: UpsertMinutesInput): unknown;
  get(meetingId: string, lang: MinutesLang): StoredMinutes | undefined;
}

/** Builds the model client for one run; `onUsage` must be called once per model call. */
export type LlmFactory = (onUsage: MinutesUsageHook) => MinutesLlm;

export interface MinutesWorkerDeps {
  runs: RunStore;
  minutes: MinutesStore;
  /** Read side the generator needs (meetings, segments, translations, marks, glossary). */
  repos: MinutesRepos;
  createLlm: LlmFactory;
  /**
   * Model for the automatic translation that follows every successful generation. Without it
   * the worker only generates (translation runs queued by hand are then not executable).
   */
  createTranslateLlm?: LlmFactory;
  usage: UsageSink;
  /** Generator overrides; a function is read per run so env mistakes fail that run only. */
  generatorConfig?: Partial<GeneratorConfig> | (() => Partial<GeneratorConfig>);
  pollMs: number;
  concurrency: number;
  /** Log line sink (default console). Never receives keys, prompts or transcript text. */
  log?: (message: string) => void;
}

export interface MinutesWorkerStatus {
  running: boolean;
  pollMs: number;
  inFlight: number;
}

export interface MinutesWorker {
  /** Recovers dead runs, then polls the queue until `stop`. */
  start(): void;
  /** Stops polling and fails in-flight runs with the restart message. Idempotent. */
  stop(): Promise<void>;
  /** One poll: claims queued runs up to the concurrency limit; returns how many it started. */
  tick(): number;
  /** Fails runs a previous process left running; returns how many. Safe to repeat. */
  recoverOnStartup(): number;
  /** Resolves when every run in flight has settled. */
  whenIdle(): Promise<void>;
  status(): MinutesWorkerStatus;
}
