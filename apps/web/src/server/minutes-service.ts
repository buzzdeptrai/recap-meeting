import type { MinutesContent, MinutesLang } from "@recap/core";
import {
  derivedStaleReasons,
  marksFingerprint,
  minutesStaleReasons,
  type Repositories,
  type StaleReason,
  type StoredMinutes,
} from "@recap/db";
import { PROMPT_VERSION } from "@recap/minutes";
import type { MinutesDto } from "@/lib/api-types";
import { getRepositories } from "./db";
import { currentMinutesModel } from "./minutes-model";
import { ServiceError } from "./service-error";

export interface MinutesServiceDeps {
  repos: Repositories;
  /** The model generation would use now (null = unknown); lets staleness notice a model change. */
  currentModel?: () => string | null;
}

function defaultDeps(): MinutesServiceDeps {
  return { repos: getRepositories(), currentModel: currentMinutesModel };
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
  if (stored.derivedFromLang) {
    // A translation only goes stale when its source minutes change (the source row carries the
    // transcript / marks / prompt reasons).
    const source = repos.minutes.get(stored.meetingId, stored.derivedFromLang);
    return derivedStaleReasons(stored.sourceHash, source?.content ?? null);
  }
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

type ReadDeps = MinutesServiceDeps;

function toDto(stored: StoredMinutes, deps: ReadDeps): MinutesDto {
  const staleReasons = minutesStaleReasonsOf(
    deps.repos,
    stored,
    deps.currentModel ? deps.currentModel() : null,
  );
  const { lang, content, source, generatedAt, updatedAt, derivedFromLang } = stored;
  return {
    lang,
    derivedFromLang,
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
