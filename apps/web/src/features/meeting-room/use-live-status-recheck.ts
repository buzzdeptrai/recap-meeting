"use client";

import { useEffect } from "react";
import type { MeetingDto } from "@/lib/api-types";
import { fetchMeetingDetail } from "@/lib/api";
import { overrideFromFreshStatus, shouldRecheckStatus, STATUS_RECHECK_MS } from "./session-phase";

/**
 * Re-reads the meeting while the room only knows a stale `live` (no recording in this tab), so the
 * header flips to the ended state as soon as the server has finished ending the session.
 */
export function useLiveStatusRecheck(
  meeting: MeetingDto,
  endedOverride: boolean | null,
  recording: boolean,
  setEndedOverride: (ended: boolean) => void,
): void {
  const poll = shouldRecheckStatus(meeting.status, endedOverride, recording);
  useEffect(() => {
    if (!poll) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const fresh = overrideFromFreshStatus(
          (await fetchMeetingDetail(meeting.id)).meeting.status,
        );
        if (!cancelled && fresh !== null) setEndedOverride(fresh);
      } catch {
        // transient network error: try again on the next tick
      }
    }, STATUS_RECHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [poll, meeting.id, setEndedOverride]);
}
