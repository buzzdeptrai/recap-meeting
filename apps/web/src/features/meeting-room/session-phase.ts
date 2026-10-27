import type { MeetingDto } from "@/lib/api-types";

type MeetingStatus = MeetingDto["status"];

export const RESUME_HINT = "Bạn sẽ chọn lại tab cuộc họp khi bấm Ghi tiếp.";

/**
 * Whether the room shows the "ended" state. `override` is set by this page's own actions
 * (resume → false, stop → true) and wins over the status the page was loaded with.
 */
export function isRoomEnded(status: MeetingStatus, override: boolean | null): boolean {
  return override ?? status === "ended";
}

/** Interval of the status re-check for a room that was loaded while the meeting was `live`. */
export const STATUS_RECHECK_MS = 3_000;

/**
 * A room loaded while the meeting is `live` but not recording here (page reload / returning to
 * the room right after leaving it) shows a status that is only true until the server finishes
 * ending the old session, so it must be re-read until it settles.
 */
export function shouldRecheckStatus(
  status: MeetingStatus,
  override: boolean | null,
  recording: boolean,
): boolean {
  return status === "live" && override === null && !recording;
}

/** Override to apply after a re-read: ended/draft means the live session is over. */
export function overrideFromFreshStatus(fresh: MeetingStatus): boolean | null {
  return fresh === "live" ? null : true;
}

/** The socket must send `resume` when the meeting already has a recording. */
export function shouldResume(status: MeetingStatus, segmentCount: number): boolean {
  return status !== "draft" || segmentCount > 0;
}

export interface RoomActions {
  minutes: boolean;
  resume: boolean;
  start: boolean;
  stop: boolean;
}

/** Which header buttons are visible: no minutes while recording, resume only when ended. */
export function roomActions(ended: boolean, recording: boolean): RoomActions {
  return {
    minutes: ended && !recording,
    resume: ended && !recording,
    start: !ended && !recording,
    stop: !ended && recording,
  };
}
