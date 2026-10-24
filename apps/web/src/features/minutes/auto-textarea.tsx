"use client";

import clsx from "clsx";
import { useLayoutEffect, useRef, type ChangeEvent, type KeyboardEvent } from "react";

interface AutoTextareaProps {
  value: string;
  onChange: (text: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
  /** Enter inserts no newline; used for single-line fields that may still wrap. */
  singleLine?: boolean;
  maxLength?: number;
}

/** Quiet until hovered or focused, like the room title; grows with its content. */
export function AutoTextarea({
  value,
  onChange,
  label,
  placeholder,
  className,
  singleLine = false,
  maxLength,
}: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (singleLine && event.key === "Enter") event.preventDefault();
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      aria-label={label}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      className={clsx(
        "block w-full resize-none overflow-hidden rounded-control border border-transparent bg-transparent px-2 py-1",
        "transition-colors duration-[120ms] placeholder:text-fg-muted/70 hover:border-line focus:bg-surface",
        className,
      )}
    />
  );
}
