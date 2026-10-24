"use client";

import { useState } from "react";
import { deleteMeetingRest } from "@/lib/api-trash";
import type { MeetingDto } from "@/lib/api-types";

/**
 * Delete flow of the meetings list: `target` is the meeting the confirm dialog is about,
 * `undo` the one just deleted (shown in the undo bar). `onChanged` refetches the list.
 */
export function useTrash(onChanged: () => void) {
  const [target, setTarget] = useState<MeetingDto | null>(null);
  const [undo, setUndo] = useState<MeetingDto | null>(null);

  /** Throws on failure so the confirm dialog keeps itself open and shows the message. */
  const confirmDelete = async () => {
    if (!target) return;
    await deleteMeetingRest(target.id);
    setUndo(target);
    onChanged();
  };

  return {
    target,
    undo,
    ask: (meeting: MeetingDto) => setTarget(meeting),
    cancel: () => setTarget(null),
    confirmDelete,
    dismissUndo: () => setUndo(null),
  };
}

export type TrashController = ReturnType<typeof useTrash>;
