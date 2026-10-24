"use client";

import { useCallback } from "react";
import { deleteMarkRest, renameMarkRest } from "@/lib/api-marks";
import type { MeetingSocketApi } from "./use-meeting-socket";

/**
 * Rename / delete a mark. Applied locally right away; sent over the socket while recording and
 * over REST otherwise (ended meetings). A failed REST call is reported through `onError`.
 */
export function useMarkActions(
  meetingId: string,
  socket: MeetingSocketApi,
  onError: (message: string) => void,
) {
  const { sendUnmark, sendMarkLabel, applyMarkRemoved, applyMarkRenamed } = socket;
  const fail = useCallback(
    (cause: unknown) =>
      onError(cause instanceof Error ? cause.message : "Không cập nhật được dấu."),
    [onError],
  );

  const removeMark = useCallback(
    (id: string) => {
      applyMarkRemoved(id);
      if (!sendUnmark(id)) deleteMarkRest(meetingId, id).catch(fail);
    },
    [meetingId, sendUnmark, applyMarkRemoved, fail],
  );

  const renameMark = useCallback(
    (id: string, label: string) => {
      applyMarkRenamed(id, label);
      if (!sendMarkLabel(id, label)) renameMarkRest(meetingId, id, label).catch(fail);
    },
    [meetingId, sendMarkLabel, applyMarkRenamed, fail],
  );

  return { removeMark, renameMark };
}
