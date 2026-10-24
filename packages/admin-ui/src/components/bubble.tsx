import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { ROW_TONE_SURFACE, type RowTone } from "./tone-ab";

export type BubbleTone = RowTone | "dashed";

export interface BubbleProps extends ComponentProps<"div"> {
  /** `dashed` = outlined, transparent (interim / not yet final text). */
  tone?: BubbleTone;
  /** `decision` adds the amber ring (use for conclusions only). */
  emphasis?: "decision";
  /** Flat top-left corner, like a speech bubble (default true). */
  tail?: boolean;
}

/** Class list for a bubble; pure so it can be tested and reused. */
export function bubbleClasses(tone: BubbleTone, emphasis?: "decision", tail = true): string {
  const surface =
    tone === "dashed"
      ? "border-[1.5px] border-dashed border-soft-line-strong bg-transparent px-[16.5px] py-[10.5px]"
      : cn(ROW_TONE_SURFACE[tone], "px-[18px] py-3");
  return cn(
    "min-w-0 text-soft-ink",
    tail
      ? "rounded-[8px_var(--soft-radius-inner)_var(--soft-radius-inner)_var(--soft-radius-inner)]"
      : "rounded-soft-inner",
    surface,
    emphasis === "decision" && "shadow-[0_0_0_2px_var(--soft-conclusion-line)]",
  );
}

/** Rounded text container for one utterance or note. */
export function Bubble({
  tone = "neutral",
  emphasis,
  tail = true,
  className,
  ...rest
}: BubbleProps) {
  return <div className={cn(bubbleClasses(tone, emphasis, tail), className)} {...rest} />;
}
