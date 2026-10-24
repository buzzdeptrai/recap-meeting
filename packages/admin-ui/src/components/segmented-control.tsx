"use client";

import type { ReactNode } from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "../lib/cn";

export interface SegmentOption<V extends string> {
  value: V;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<V extends string> {
  options: ReadonlyArray<SegmentOption<V>>;
  value: V;
  onValueChange: (value: V) => void;
  /** Names the group for assistive tech, e.g. "Khoảng thời gian". */
  ariaLabel: string;
  /** `pill`: white floating track, gradient active (range pickers). `tabs`: grey track, white active (metric switch). `soft`: fully round inset track, white active chip (v2, room/toolbars). */
  variant?: "pill" | "tabs" | "soft";
  /** `sm` for toolbars and dense rows. */
  size?: "sm" | "md";
  /** Stretch the options to fill the row (forms). */
  fill?: boolean;
  className?: string;
}

const TRACK = {
  pill: "bg-soft-surface shadow-soft-sm",
  tabs: "bg-soft-bg flex-wrap",
  soft: "bg-soft-inset",
} as const;

const TRACK_SHAPE = { pill: "rounded-xl", tabs: "rounded-xl", soft: "rounded-soft-pill" } as const;
const ITEM_SHAPE = {
  pill: "rounded-[9px]",
  tabs: "rounded-[9px]",
  soft: "rounded-soft-pill",
} as const;

const ITEM_SIZE = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-[13px] max-[640px]:px-3",
} as const;

const ITEM_ON = {
  pill: "data-[state=on]:bg-soft-main data-[state=on]:text-white data-[state=on]:shadow-[0_3px_6px_rgba(29,78,216,0.3)]",
  tabs: "data-[state=on]:bg-soft-surface data-[state=on]:text-soft-ink data-[state=on]:shadow-soft-sm",
  soft: "data-[state=on]:bg-soft-surface data-[state=on]:font-semibold data-[state=on]:text-soft-ink data-[state=on]:shadow-soft-seg",
} as const;

/** Single-choice toggle group with roving focus (arrow keys). Selection cannot be cleared. */
export function SegmentedControl<V extends string>({
  options,
  value,
  onValueChange,
  ariaLabel,
  variant = "pill",
  size = "md",
  fill = false,
  className,
}: SegmentedControlProps<V>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={ariaLabel}
      onValueChange={(next) => {
        if (next) onValueChange(next as V);
      }}
      className={cn(
        "gap-1 p-1",
        TRACK_SHAPE[variant],
        fill ? "flex w-full" : "inline-flex",
        TRACK[variant],
        className,
      )}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "soft-focus inline-flex cursor-pointer items-center justify-center gap-2 font-semibold whitespace-nowrap text-soft-muted transition-all duration-150 hover:text-soft-ink disabled:cursor-not-allowed disabled:opacity-50",
            ITEM_SHAPE[variant],
            ITEM_SIZE[size],
            fill && "flex-1",
            ITEM_ON[variant],
          )}
        >
          {o.icon}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
