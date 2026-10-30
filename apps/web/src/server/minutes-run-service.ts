import type { MinutesLang } from "@recap/core";
import type { MinutesRun, Repositories } from "@recap/db";
import { PROMPT_VERSION, UNCLAIMED_RUN_ERROR, queuedClaimTimeoutMsFromEnv } from "@recap/minutes";
import type { MinutesRunDto } from "@/lib/api-types";
import { getRepositories } from "./db";
import { currentMinutesModel, requireMinutesModel } from "./minutes-model";
import { requireEndedMeeting, requireMeeting } from "./minutes-service";
import { ServiceError } from "./service-error";

/** A queued/running row not updated for this long is treated as abandoned (e.g. server restart). */
export const DEFAULT_STALE_RUN_MS = 10 * 60_000;
export const STALE_RUN_ERROR = "Lần tạo biên bản bị gián đoạn. Vui lòng thử lại.";

/**
 * The web side of minutes generation only enqueues and reads progress. The model runs in the
 * minutes worker inside `apps/realtime` (see docs/ARCHITECTURE.md, "Background minutes worker").
 */
export interface MinutesRunDeps {
  repos: Repositories;
  /** Model a new run is stamped with; throws 503 when the service is not configured. */
  requireModel: () => string;
  /** The model generation would use now (null = unknown). */
  currentModel?: () => string | null;
  /** Clock in epoch ms (tests). */
  now?: () => number;
  /** A queued/running row not updated for this long is treated as failed. */
  staleRunMs?: number;
  /** A queued run no worker claimed for this long is failed. */
  queuedClaimTimeoutMs?: number;
}

export function defaultRunDeps(): MinutesRunDeps {
  return {
    repos: getRepositories(),
    requireModel: requireMinutesModel,
    currentModel: currentMinutesModel,
  };
}

/** `MINUTES_RUN_STALE_MS` overrides the abandoned-run timeout. */
export function staleRunMsFromEnv(env: Record<string, string | undefined>): number {
  const value = Number(env.MINUTES_RUN_STALE_MS);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_STALE_RUN_MS;
}

export const toRunDto = (run: MinutesRun, ahead = 0): MinutesRunDto => ({
  runId: run.id,
  kind: run.kind,
  lang: run.lang,
  status: run.status,
  phase: run.phase,
  done: run.doneChunks,
  total: run.totalChunks,
  error: run.error,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
  ahead,
});

/** Runs the worker handles before this one; only meaningful (and queried) while it is queued. */
export const runsAhead = (deps: MinutesRunDeps, run: MinutesRun): number =>
  run.status === "queued" ? deps.repos.minutesRuns.runsAhead(run.id) : 0;

const cutoffIso = (deps: MinutesRunDeps, timeoutMs: number) =>
  new Date((deps.now ?? Date.now)() - timeoutMs).toISOString();

/**
 * Fails running rows that stopped updating, and queued rows no worker picked up. A queued row is
 * only "unclaimed" when no worker activity is visible (nothing running recently, nothing finished
 * within the claim window): waiting behind another run is normal. Idempotent.
 */
export function failAbandoned(deps: MinutesRunDeps, meetingId: string, lang: MinutesLang) {
  const { minutesRuns } = deps.repos;
  const staleMs = deps.staleRunMs ?? staleRunMsFromEnv(process.env);
  minutesRuns.failStale(meetingId, lang, cutoffIso(deps, staleMs), STALE_RUN_ERROR);
  const claimMs = deps.queuedClaimTimeoutMs ?? queuedClaimTimeoutMsFromEnv(process.env);
  if (minutesRuns.hasWorkerActivity(cutoffIso(deps, staleMs), cutoffIso(deps, claimMs))) return;
  minutesRuns.failUnclaimed(meetingId, lang, cutoffIso(deps, claimMs), UNCLAIMED_RUN_ERROR);
}

/**
 * Enqueues a generation and returns the queued run at once. Preconditions (meeting exists and
 * ended, has a transcript, the model is configured) fail synchronously. A queued/running run of
 * the same meeting + language is returned instead of a new one.
 */
export function startMinutesRun(
  meetingId: string,
  lang: MinutesLang,
  deps: MinutesRunDeps = defaultRunDeps(),
): MinutesRunDto {
  requireEndedMeeting(deps.repos, meetingId);
  if (deps.repos.segments.latestCreatedAt(meetingId) === null) {
    throw new ServiceError(422, "EMPTY_TRANSCRIPT", "Cuộc họp chưa có nội dung để lập biên bản.");
  }
  const model = deps.requireModel();
  failAbandoned(deps, meetingId, lang);
  const { run } = deps.repos.minutesRuns.start({
    meetingId,
    lang,
    model,
    promptVersion: PROMPT_VERSION,
  });
  if (run.kind !== "generate") throw runBusy();
  return toRunDto(run, runsAhead(deps, run));
}

const runBusy = () =>
  new ServiceError(409, "RUN_BUSY", "Biên bản ngôn ngữ này đang được dịch. Hãy đợi dịch xong.");

/** Latest run of a meeting + language (undefined when none). Fails abandoned runs lazily. */
export function getLatestRun(
  meetingId: string,
  lang: MinutesLang,
  deps: MinutesRunDeps = defaultRunDeps(),
): MinutesRunDto | undefined {
  requireMeeting(deps.repos, meetingId);
  failAbandoned(deps, meetingId, lang);
  const run = deps.repos.minutesRuns.latest(meetingId, lang);
  return run ? toRunDto(run, runsAhead(deps, run)) : undefined;
}
