"use client";

import type { ReactNode } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

export interface TooltipProps {
  content: ReactNode;
  /** A single focusable element; it receives the trigger behaviour. */
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delayMs?: number;
}

/** Self-contained tooltip (brings its own provider). Short, non-interactive text only. */
export function Tooltip({ content, children, side = "top", delayMs = 200 }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayMs}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-xs rounded-[10px] bg-soft-navy px-3 py-1.5 text-xs font-semibold text-white shadow-soft-pop"
          >
            {content}
            <RadixTooltip.Arrow className="fill-soft-navy" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
