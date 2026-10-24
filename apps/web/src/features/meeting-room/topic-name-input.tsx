"use client";

import { useEffect, useRef } from "react";
import { MARK_LABEL_MAX } from "@recap/core";

interface TopicNameInputProps {
  initial: string;
  onSave: (label: string) => void;
  onSkip: () => void;
}

/** Inline name field: Enter saves, Esc skips (the topic keeps its default name). */
export function TopicNameInput({ initial, onSave, onSkip }: TopicNameInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const value = ref.current?.value.trim() ?? "";
    if (save && value && value !== initial) onSave(value);
    else onSkip();
  };

  return (
    <input
      ref={ref}
      defaultValue={initial}
      maxLength={MARK_LABEL_MAX}
      placeholder="Đặt tên chủ đề"
      aria-label="Đặt tên chủ đề"
      onKeyDown={(event) => {
        if (event.key === "Enter") finish(true);
        if (event.key === "Escape") finish(false);
      }}
      onBlur={() => finish(true)}
      className="h-8 w-full min-w-0 rounded-control border border-accent bg-surface px-2 text-small text-fg outline-none placeholder:text-fg-muted"
    />
  );
}
