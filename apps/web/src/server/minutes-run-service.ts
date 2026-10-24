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

function defaultDeps(): MinutesRunDeps {
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

const cutoffIso = (deps: MinutesRunDeps, timeoutMs: number) =>
  new Date((deps.now ?? Date.now)() - timeoutMs).toISOString();

/** Fails active runs that stopped updating, and queued runs no worker picked up. Idempotent. */
function failAbandoned(deps: MinutesRunDeps, meetingId: string, lang: MinutesLang) {
  const { minutesRuns } = deps.repos;
  const staleMs = deps.staleRunMs ?? staleRunMsFromEnv(process.env);
  minutesRuns.failStale(meetingId, lang, cutoffIso(deps, staleMs), STALE_RUN_ERROR);
  const claimMs = deps.queuedClaimTimeoutMs ?? queuedClaimTimeoutMsFromEnv(process.env);
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
  deps: MinutesRunDeps = defaultDeps(),
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
  return toRunDto(run);
}

/** Latest run of a meeting + language (undefined when none). Fails abandoned runs lazily. */
export function getLatestRun(
  meetingId: string,
  lang: MinutesLang,
  deps: MinutesRunDeps = defaultDeps(),
): MinutesRunDto | undefined {
  requireMeeting(deps.repos, meetingId);
  failAbandoned(deps, meetingId, lang);
  const run = deps.repos.minutesRuns.latest(meetingId, lang);
  return run ? toRunDto(run) : undefined;
}
