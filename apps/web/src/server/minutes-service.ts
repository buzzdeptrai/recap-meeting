import type { MinutesContent, MinutesLang } from "@recap/core";
import { isChangedSince, type Repositories, type StoredMinutes } from "@recap/db";
import {
  MinutesError,
  generateMinutes,
  generatorConfigFromEnv,
  type MinutesLlm,
} from "@recap/minutes";
import type { MinutesDto } from "@/lib/api-types";
import { getRepositories } from "./db";
import { getMinutesLlm } from "./minutes-llm";
import { ServiceError } from "./service-error";
import { usageContext } from "./usage-recorder";

export interface MinutesServiceDeps {
  repos: Repositories;
  /** Lazy so routes that never generate do not need an API key. */
  llm: () => MinutesLlm;
}

const inFlight = new Map<string, Promise<MinutesDto>>();

function defaultDeps(): MinutesServiceDeps {
  return { repos: getRepositories(), llm: getMinutesLlm };
}

/**
 * True when the transcript or the marks changed after the minutes were generated (rule shared
 * with the meetings list: `@recap/db` minutes-staleness).
 */
export function isMinutesStale(repos: Repositories, meetingId: string, generatedAt: string) {
  return isChangedSince(generatedAt, [
    repos.segments.latestCreatedAt(meetingId),
    repos.marks.latestChangeAt(meetingId),
  ]);
}

const toDto = (
  { lang, content, source, generatedAt, updatedAt }: StoredMinutes,
  stale: boolean,
): MinutesDto => ({
  lang,
  content,
  source,
  generatedAt,
  updatedAt,
  stale,
});

const meetingNotFound = () => new ServiceError(404, "NOT_FOUND", "Không tìm thấy cuộc họp này.");

function requireMeeting(repos: Repositories, meetingId: string) {
  const meeting = repos.meetings.get(meetingId);
  if (!meeting) throw meetingNotFound();
  return meeting;
}

const ERROR_MAP: Record<string, [number, string, string]> = {
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

async function runGeneration(meetingId: string, lang: MinutesLang, deps: MinutesServiceDeps) {
  try {
    const result = await usageContext.run({ meetingId }, () =>
      generateMinutes(
        { meetingId, lang },
        { repos: deps.repos, llm: deps.llm(), config: generatorConfigFromEnv(process.env) },
      ),
    );
    return toDto(
      deps.repos.minutes.upsert({
        meetingId,
        lang,
        content: result.content,
        source: "ai",
        model: result.model,
      }),
      false,
    );
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
  const meeting = requireMeeting(deps.repos, meetingId);
  if (meeting.status !== "ended") {
    throw new ServiceError(
      409,
      "MEETING_NOT_ENDED",
      "Chỉ lập biên bản được khi cuộc họp đã kết thúc.",
    );
  }
  const key = `${meetingId}:${lang}`;
  const running = inFlight.get(key);
  if (running) return running;
  const job = runGeneration(meetingId, lang, deps).finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

export function getMinutes(
  meetingId: string,
  lang: MinutesLang,
  deps: Pick<MinutesServiceDeps, "repos"> = defaultDeps(),
): MinutesDto {
  requireMeeting(deps.repos, meetingId);
  const stored = deps.repos.minutes.get(meetingId, lang);
  if (!stored)
    throw new ServiceError(404, "MINUTES_NOT_FOUND", "Chưa có biên bản cho ngôn ngữ này.");
  return toDto(stored, isMinutesStale(deps.repos, meetingId, stored.generatedAt));
}

/** Saves a user edit. The minutes must already exist (generate first). */
export function saveEditedMinutes(
  meetingId: string,
  lang: MinutesLang,
  content: MinutesContent,
  deps: Pick<MinutesServiceDeps, "repos"> = defaultDeps(),
): MinutesDto {
  getMinutes(meetingId, lang, deps);
  const saved = deps.repos.minutes.upsert({ meetingId, lang, content, source: "edited" });
  return toDto(saved, isMinutesStale(deps.repos, meetingId, saved.generatedAt));
}
