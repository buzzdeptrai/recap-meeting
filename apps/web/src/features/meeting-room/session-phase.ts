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
