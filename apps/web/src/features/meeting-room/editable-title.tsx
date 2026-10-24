"use client";

import { useState, type KeyboardEvent } from "react";
import { renameMeeting } from "@/lib/api";

interface EditableTitleProps {
  meetingId: string;
  initialTitle: string;
}

/** Always-an-input title: quiet until hovered or focused; saves on blur or Enter. */
export function EditableTitle({ meetingId, initialTitle }: EditableTitleProps) {
  const [saved, setSaved] = useState(initialTitle);
  const [draft, setDraft] = useState(initialTitle);
  const [failed, setFailed] = useState(false);

  async function commit() {
    const next = draft.trim();
    if (!next || next === saved) return setDraft(saved);
    try {
      await renameMeeting(meetingId, next);
      setSaved(next);
      setDraft(next);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      setDraft(saved);
      event.currentTarget.blur();
    }
  };

  return (
    <input
      value={draft}
      aria-label="Tiêu đề cuộc họp"
      aria-invalid={failed || undefined}
      title={failed ? "Chưa lưu được tiêu đề. Bấm Enter để thử lại." : undefined}
      maxLength={200}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className="h-8 min-w-0 flex-1 text-ellipsis rounded-control border border-transparent bg-transparent px-2 text-[15px] font-semibold transition-colors duration-[120ms] hover:border-line focus:bg-surface aria-[invalid=true]:border-err sm:max-w-md"
    />
  );
}
