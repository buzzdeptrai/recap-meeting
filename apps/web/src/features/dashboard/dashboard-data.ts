import type { Meeting } from "@recap/db";
import { getRepositories } from "@/server/db";
import { listMeetings } from "@/server/meetings-service";
import { dayKeys, reliabilityQuerySchema, summaryQuerySchema } from "@/server/usage-range";
import { getReliability, type UsageServiceDeps } from "@/server/usage-service";
import type { MeetingListItemDto } from "@/lib/api-types";
import { DEFAULT_STATE, rangeParams } from "@/features/usage/usage-url";

const ALL_MEETINGS = 100_000;
const ATTENTION_SCAN = 200;
export const RECENT_COUNT = 5;

export type DashboardMeeting = Pick<Meeting, "createdAt" | "startedAt" | "durationMs">;

/** Meeting-centric figures (no usage, token or money data). */
export interface MeetingSource {
  meetings: DashboardMeeting[];
  recent: MeetingListItemDto[];
  /** Ended meetings (newest first) the attention card scans. */
  ended: MeetingListItemDto[];
  drafts: MeetingListItemDto[];
  /** Ended meetings that still need minutes created or refreshed (exact count). */
  needMinutes: number;
  /** Conclusion markers set during the month so far. */
  conclusions: number;
}

export interface DashboardInputs extends MeetingSource {
  nowMs: number;
  range: { from: string; to: string; tzOffsetMinutes: number };
  days: string[];
  /** Service health only: error rate and latency per model. */
  reliability: ReturnType<typeof getReliability>;
}

function loadMeetingSource(nowMs: number, range: DashboardInputs["range"]): MeetingSource {
  const repos = getRepositories();
  const page = (status: "ended" | "draft") =>
    listMeetings({ status, limit: ATTENTION_SCAN, now: nowMs }).meetings;
  return {
    meetings: repos.meetings.list({ limit: ALL_MEETINGS }),
    recent: listMeetings({ limit: RECENT_COUNT, now: nowMs }).meetings,
    ended: page("ended"),
    drafts: page("draft"),
    needMinutes: listMeetings({ minutes: "need", limit: 1, now: nowMs }).total,
    conclusions: repos.marks.countByKind("conclusion", range.from, range.to),
  };
}

/** Everything `/` shows, for the current local month. `source` is injectable for tests. */
export function loadDashboard(
  nowMs: number,
  deps?: UsageServiceDeps,
  source?: Partial<MeetingSource>,
): DashboardInputs {
  const params = rangeParams(DEFAULT_STATE, nowMs);
  const range = summaryQuerySchema.parse(params);
  const base: MeetingSource = source
    ? {
        meetings: [],
        recent: [],
        ended: [],
        drafts: [],
        needMinutes: 0,
        conclusions: 0,
        ...source,
      }
    : loadMeetingSource(nowMs, range);
  return {
    ...base,
    nowMs,
    range,
    days: dayKeys(range),
    reliability: getReliability(reliabilityQuerySchema.parse(params), deps),
  };
}
