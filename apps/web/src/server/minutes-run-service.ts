import type { MinutesLang } from "@recap/core";
import type { MinutesRun } from "@recap/db";
import { PROMPT_VERSION, type MinutesProgress } from "@recap/minutes";
import type { MinutesRunDto } from "@/lib/api-types";
import { getRepositories } from "./db";
import { currentMinutesModel, getMinutesLlm } from "./minutes-llm";
import {
  produceMinutes,
  requireEndedMeeting,
  requireMeeting,
  safeFailureMessage,
  type MinutesServiceDeps,
} from "./minutes-service";
import { ServiceError } from "./service-error";
import { usageContext } from "./usage-recorder";

/** A queued/running row not updated for this long is treated as abandoned (e.g. server restart). */
export const DEFAULT_STALE_RUN_MS = 10 * 60_000;
export const STALE_RUN_ERROR = "Lần tạo biên bản bị gián đoạn. Vui lòng thử lại.";
const GENERIC_ERROR = "Không tạo được biên bản. Vui lòng thử lại.";

/** In-process jobs by run id; the DB row, not this map, is the source of truth for the UI. */
const jobs = new Map<string, Promise<void>>();

type RunDeps = MinutesServiceDeps;

function defaultDeps(): RunDeps {
  return { repos: getRepositories(), llm: getMinutesLlm, currentModel: currentMinutesModel };
}

/** `MINUTES_RUN_STALE_MS` overrides the abandoned-run timeout. */
export function staleRunMsFromEnv(env: Record<string, string | undefined>): number {
  const value = Number(env.MINUTES_RUN_STALE_MS);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_STALE_RUN_MS;
}

const toRunDto = (run: MinutesRun): MinutesRunDto => ({
  runId: run.id,
  lang: run.lang,
  status: run.status,
  phase: run.phase,
  done: run.doneChunks,
  total: run.totalChunks,
  error: run.error,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
});

/** Fails active runs of this meeting + language that stopped updating. Idempotent. */
function failAbandoned(deps: RunDeps, meetingId: string, lang: MinutesLang) {
  const timeoutMs = deps.staleRunMs ?? staleRunMsFromEnv(process.env);
  const cutoff = new Date((deps.now ?? Date.now)() - timeoutMs).toISOString();
  deps.repos.minutesRuns.failStale(meetingId, lang, cutoff, STALE_RUN_ERROR);
}

/** Resolves when the in-process job of a run is over (for tests and graceful hooks). */
export function whenRunSettled(runId: string): Promise<void> {
  return jobs.get(runId) ?? Promise.resolve();
}

/** Writes progress to the DB when the step changes (one write per chunk, never per token). */
function progressWriter(deps: RunDeps, runId: string) {
  let last = "";
  return (progress: MinutesProgress) => {
    const key = `${progress.phase}:${progress.done}:${progress.total}`;
    if (key === last) return;
    last = key;
    try {
      deps.repos.minutesRuns.updateProgress(runId, progress);
    } catch {
      // progress is best effort; the run itself must go on
    }
  };
}

function failRun(deps: RunDeps, runId: string, message: string) {
  try {
    deps.repos.minutesRuns.fail(runId, message);
  } catch {
    // nothing more can be done; the abandoned-run timeout will catch the row
  }
}

async function executeRun(deps: RunDeps, run: MinutesRun): Promise<void> {
  const { id, meetingId, lang } = run;
  try {
    deps.repos.minutesRuns.markRunning(id);
    await produceMinutes(meetingId, lang, deps, progressWriter(deps, id));
    deps.repos.minutesRuns.finish(id);
  } catch (err) {
    // Log the kind only: error messages from the model client may carry request details.
    console.error("[minutes] run failed:", err instanceof Error ? err.name : "unknown");
    failRun(deps, id, safeFailureMessage(err));
  } finally {
    // Never leave a row active after the job is over (idempotent: no-op once terminal).
    failRun(deps, id, GENERIC_ERROR);
    jobs.delete(id);
  }
}

/**
 * Starts generating the minutes in the background and returns the run at once. Preconditions
 * (meeting exists and ended, has a transcript, the model is configured) fail synchronously, as
 * before. A queued/running run of the same meeting + language is returned instead of a new one.
 */
export function startMinutesRun(
  meetingId: string,
  lang: MinutesLang,
  deps: RunDeps = defaultDeps(),
): MinutesRunDto {
  requireEndedMeeting(deps.repos, meetingId);
  if (deps.repos.segments.latestCreatedAt(meetingId) === null) {
    throw new ServiceError(422, "EMPTY_TRANSCRIPT", "Cuộc họp chưa có nội dung để lập biên bản.");
  }
  const model = deps.llm().model;
  failAbandoned(deps, meetingId, lang);
  const { run, created } = deps.repos.minutesRuns.start({
    meetingId,
    lang,
    model,
    promptVersion: PROMPT_VERSION,
  });
  if (created) {
    const job = Promise.resolve().then(() =>
      usageContext.run({ meetingId }, () => executeRun(deps, run)),
    );
    jobs.set(run.id, job);
  }
  return toRunDto(run);
}

/** Latest run of a meeting + language (undefined when none). Fails abandoned runs lazily. */
export function getLatestRun(
  meetingId: string,
  lang: MinutesLang,
  deps: RunDeps = defaultDeps(),
): MinutesRunDto | undefined {
  requireMeeting(deps.repos, meetingId);
  failAbandoned(deps, meetingId, lang);
  const run = deps.repos.minutesRuns.latest(meetingId, lang);
  return run ? toRunDto(run) : undefined;
}
