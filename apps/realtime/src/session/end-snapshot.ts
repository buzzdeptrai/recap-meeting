import type { Meeting, Repositories } from "@recap/db";

/** How an ended meeting looked before a resume session re-opened it. */
export interface EndSnapshot {
  endedAt: string;
  durationMs: number | null;
}

export function snapshotEnd(meeting: Meeting | undefined): EndSnapshot | null {
  if (!meeting || meeting.status !== "ended" || !meeting.endedAt) return null;
  return { endedAt: meeting.endedAt, durationMs: meeting.durationMs };
}

/**
 * Ends the meeting. A resume that took no audio (`keep` set) must not move the original end;
 * otherwise the duration is the recorded audio.
 */
export function endMeetingRecorded(
  repos: Repositories,
  meetingId: string,
  recordedMs: number,
  keep: EndSnapshot | null,
): void {
  if (keep) {
    repos.meetings.end(meetingId, keep.endedAt, keep.durationMs ?? undefined);
    return;
  }
  repos.meetings.end(meetingId, undefined, recordedMs > 0 ? recordedMs : undefined);
}
