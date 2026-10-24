import type { MinutesContent, MinutesLang } from "@recap/core";
import {
  marksFingerprint,
  minutesStaleReasons,
  type Repositories,
  type StaleReason,
  type StoredMinutes,
} from "@recap/db";
import {
  MinutesError,
  PROMPT_VERSION,
  generateMinutes,
  generatorConfigFromEnv,
  type GeneratorConfig,
  type MinutesLlm,
  type MinutesProgress,
} from "@recap/minutes";
import type { MinutesDto } from "@/lib/api-types";
import { getRepositories } from "./db";
import { currentMinutesModel, getMinutesLlm } from "./minutes-llm";
import { ServiceError } from "./service-error";
import { usageContext } from "./usage-recorder";

export interface MinutesServiceDeps {
  repos: Repositories;
  /** Lazy so routes that never generate do not need an API key. */
  llm: () => MinutesLlm;
  /** The model generation would use now (null = unknown); lets staleness notice a model change. */
  currentModel?: () => string | null;
  /** Clock in epoch ms (tests). */
  now?: () => number;
  /** A running row not updated for this long is treated as failed. */
  staleRunMs?: number;
  /** Generator overrides on top of the env config (tests). */
  config?: Partial<GeneratorConfig>;
}

const inFlight = new Map<string, Promise<MinutesDto>>();

function defaultDeps(): MinutesServiceDeps {
  return { repos: getRepositories(), llm: getMinutesLlm, currentModel: currentMinutesModel };
}

/**
 * Why the minutes are stale (empty = fresh): timestamps (transcript / marks changed), the set of
 * marks (one was deleted), the prompt version and the configured model. See `@recap/db`
 * minutes-staleness for the rule; NULL stored fields never flag stale.
 */
export function minutesStaleReasonsOf(
  repos: Repositories,
  stored: StoredMinutes,
  currentModel: string | null,
): StaleReason[] {
  return minutesStaleReasons({
    generatedAt: stored.generatedAt,
    latestSegmentAt: repos.segments.latestCreatedAt(stored.meetingId),
    latestMarkChangeAt: repos.marks.latestChangeAt(stored.meetingId),
    stored: {
      promptVersion: stored.promptVersion,
      model: stored.model,
      marksFingerprint: stored.marksFingerprint,
    },
    current: {
      promptVersion: PROMPT_VERSION,
      model: currentModel,
      marksFingerprint: marksFingerprint(repos.marks.list(stored.meetingId)),
    },
  });
}

type ReadDeps = Pick<MinutesServiceDeps, "repos" | "currentModel">;

function toDto(stored: StoredMinutes, deps: ReadDeps): MinutesDto {
  const staleReasons = minutesStaleReasonsOf(
    deps.repos,
    stored,
    deps.currentModel ? deps.currentModel() : null,
  );
  const { lang, content, source, generatedAt, updatedAt } = stored;
  return {
    lang,
    content,
    source,
    generatedAt,
    updatedAt,
    stale: staleReasons.length > 0,
    staleReasons,
  };
}

const meetingNotFound = () => new ServiceError(404, "NOT_FOUND", "Không tìm thấy cuộc họp này.");

export function requireMeeting(repos: Repositories, meetingId: string) {
  const meeting = repos.meetings.get(meetingId);
  if (!meeting) throw meetingNotFound();
  return meeting;
}

/** The meeting must exist and have ended (minutes are built from the full transcript). */
export function requireEndedMeeting(repos: Repositories, meetingId: string) {
  const meeting = requireMeeting(repos, meetingId);
  if (meeting.status !== "ended") {
    throw new ServiceError(
      409,
      "MEETING_NOT_ENDED",
      "Chỉ lập biên bản được khi cuộc họp đã kết thúc.",
    );
  }
  return meeting;
}

export const ERROR_MAP: Record<string, [number, string, string]> = {
  MEETING_NOT_FOUND: [404, "NOT_FOUND", "Không tìm thấy cuộc họp này."],
  EMPTY_TRANSCRIPT: [422, "EMPTY_TRANSCRIPT", "Cuộc họp chưa có nội dung để lập biên bản."],
  INVALID_OUTPUT: [502, "MINUTES_FAILED", "Mô hình trả về kết quả không hợp lệ. Vui lòng thử lại."],
  LLM_FAILED: [502, "MINUTES_FAILED", "Không tạo được biên bản. Vui lòng thử lại."],
  CONFIG: [503, "MINUTES_UNAVAILABLE", "Chưa cấu hình dịch vụ tạo biên bản."],
};

function toServiceError(err: unknown): unknown {
  if (!(err instanceof MinutesError)) return err;
  const [status, code, message] = ERROR_MAP[err.code] ?? [502, "MINUTES_FAILED", err.message];
  return new ServiceError(status, code, message);
}

const GENERIC_FAILURE = "Không tạo được biên bản. Vui lòng thử lại.";

/**
 * Text that is safe to show to the user and to store on a run: a curated message, never the
 * original error (which may carry request details).
 */
export function safeFailureMessage(err: unknown): string {
  if (err instanceof ServiceError) return err.message;
  if (err instanceof MinutesError) return ERROR_MAP[err.code]?.[2] ?? GENERIC_FAILURE;
  return GENERIC_FAILURE;
}

/** Generates the minutes and stores them as an `ai` version stamped with its prompt / marks. */
export async function produceMinutes(
  meetingId: string,
  lang: MinutesLang,
  deps: MinutesServiceDeps,
  onProgress?: (progress: MinutesProgress) => void,
): Promise<MinutesDto> {
  try {
    const result = await usageContext.run({ meetingId }, () =>
      generateMinutes(
        { meetingId, lang },
        {
          repos: deps.repos,
          llm: deps.llm(),
          config: { ...generatorConfigFromEnv(process.env), ...deps.config },
          onProgress,
        },
      ),
    );
    const stored = deps.repos.minutes.upsert({
      meetingId,
      lang,
      content: result.content,
      source: "ai",
      model: result.model,
      promptVersion: result.promptVersion,
      marksFingerprint: result.marksFingerprint,
    });
    return toDto(stored, deps);
  } catch (err) {
    throw toServiceError(err);
  }
}

/** Generates (or regenerates) and stores minutes. Concurrent identical requests share one run. */
export async function generateAndStoreMinutes(
  meetingId: string,
  lang: MinutesLang,
  deps: MinutesServiceDeps = defaultDeps(),
): Promise<MinutesDto> {
  requireEndedMeeting(deps.repos, meetingId);
  const key = `${meetingId}:${lang}`;
  const running = inFlight.get(key);
  if (running) return running;
  const job = produceMinutes(meetingId, lang, deps).finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

export function getMinutes(
  meetingId: string,
  lang: MinutesLang,
  deps: ReadDeps = defaultDeps(),
): MinutesDto {
  requireMeeting(deps.repos, meetingId);
  const stored = deps.repos.minutes.get(meetingId, lang);
  if (!stored)
    throw new ServiceError(404, "MINUTES_NOT_FOUND", "Chưa có biên bản cho ngôn ngữ này.");
  return toDto(stored, deps);
}

/** Saves a user edit. The minutes must already exist (generate first). */
export function saveEditedMinutes(
  meetingId: string,
  lang: MinutesLang,
  content: MinutesContent,
  deps: ReadDeps = defaultDeps(),
): MinutesDto {
  getMinutes(meetingId, lang, deps);
  const saved = deps.repos.minutes.upsert({ meetingId, lang, content, source: "edited" });
  return toDto(saved, deps);
}
