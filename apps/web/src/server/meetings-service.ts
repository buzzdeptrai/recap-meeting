import type { Mark } from "@recap/core";
import type { LangFilter, Meeting, MeetingSort, MeetingStatus, MinutesFilter } from "@recap/db";
import type { MarkAnchorDto, MeetingDetailDto, MeetingListDto } from "@/lib/api-types";
import type { RangeValue } from "@/lib/list-query";
import { vnWeekStart } from "@/lib/vn-time";
import { getRepositories } from "./db";
import { resolveRange } from "./list-range";
import { loadSegmentsPage } from "./transcript-service";

/** Segments sent with the room's first render; the rest is fetched page by page. */
export const INITIAL_PAGE_SIZE = 200;

export interface MeetingListParams {
  q?: string;
  status?: MeetingStatus;
  minutes?: MinutesFilter;
  lang?: LangFilter;
  range?: RangeValue;
  /** `YYYY-MM-DD` Vietnam days, inclusive. */
  from?: string;
  to?: string;
  sort?: MeetingSort;
  limit?: number;
  offset?: number;
  /** Epoch ms; injectable for tests (defaults to the clock). */
  now?: number;
}

/**
 * Meetings newest first (or by `sort`), ranked by relevance when `q` is given, with per-row
 * counters and list-level `counts` / `totals` (see `MeetingListDto`).
 */
export function listMeetings(params: MeetingListParams = {}): MeetingListDto {
  const { now = Date.now(), range, from, to, ...rest } = params;
  const window = resolveRange({ range, from, to }, now);
  const result = getRepositories().meetings.search({
    ...rest,
    ...window,
    weekFrom: new Date(vnWeekStart(now)).toISOString(),
  });
  return {
    total: result.total,
    counts: result.counts,
    totals: result.totals,
    meetings: result.meetings.map(({ hasMinutes, ...meeting }) => ({
      ...meeting,
      minutesLangs: hasMinutes,
    })),
  };
}

export interface MeetingDetailOptions {
  /** Open the page around this time on the meeting timeline (`?t=`). */
  aroundMs?: number | null;
  pageSize?: number;
}

/** Page the room starts on: around `aroundMs`, the tail of a live meeting, else the head. */
function initialPage(meeting: Meeting, options: MeetingDetailOptions) {
  const repos = getRepositories();
  const limit = options.pageSize ?? INITIAL_PAGE_SIZE;
  if (options.aroundMs !== null && options.aroundMs !== undefined) {
    const at = repos.segments.locate(meeting.id, { atMs: options.aroundMs, limit });
    if (at) return loadSegmentsPage(meeting.id, { from: at.from, limit, dir: "forward" });
  }
  const dir = meeting.status === "live" ? "backward" : "forward";
  return loadSegmentsPage(meeting.id, { limit, dir });
}

function markAnchors(meetingId: string, marks: Mark[]): Record<string, MarkAnchorDto> {
  const anchors: Record<string, MarkAnchorDto> = {};
  for (const mark of marks) {
    if (mark.kind !== "conclusion") continue;
    const anchor = getRepositories().segments.anchorAt(meetingId, mark.atMs);
    if (anchor) anchors[mark.id] = anchor;
  }
  return anchors;
}

/** Meeting, all marks, counters and the first page of the transcript (see `MeetingDetailDto`). */
export function getMeetingDetail(
  id: string,
  options: MeetingDetailOptions = {},
): MeetingDetailDto | undefined {
  const repos = getRepositories();
  const meeting = repos.meetings.get(id);
  if (!meeting) return undefined;
  const marks = repos.marks
    .list(id)
    .map(({ id: markId, kind, atMs, label }) => ({ id: markId, kind, atMs, label }));
  return {
    meeting,
    marks,
    markAnchors: markAnchors(id, marks),
    stats: repos.segments.stats(id),
    page: initialPage(meeting, options),
  };
}

/** Just the meeting row (pages that do not show the transcript). */
export const getMeetingById = (id: string): Meeting | undefined =>
  getRepositories().meetings.get(id);

/** Server clock in epoch ms (a function so render code stays free of impure calls). */
export const serverNow = (): number => Date.now();
