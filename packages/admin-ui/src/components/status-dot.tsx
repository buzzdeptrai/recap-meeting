import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const dotVariants = cva("inline-block size-2 shrink-0 rounded-full", {
  variants: {
    status: {
      ok: "bg-soft-ok shadow-[0_0_0_4px_rgba(23,173,55,0.15)]",
      warn: "bg-soft-warn shadow-[0_0_0_4px_rgba(232,161,0,0.18)]",
      bad: "bg-soft-bad shadow-[0_0_0_4px_rgba(234,6,6,0.14)]",
      rec: "bg-soft-pink shadow-[0_0_0_4px_rgba(255,0,128,0.15)]",
      idle: "bg-[#a0a8b8] shadow-[0_0_0_4px_rgba(160,168,184,0.18)]",
    },
    pulse: { true: "motion-safe:animate-pulse", false: "" },
  },
  defaultVariants: { status: "ok", pulse: false },
});

export interface StatusDotProps
  extends Omit<ComponentProps<"span">, "children">, VariantProps<typeof dotVariants> {
  /** Accessible name; omit when the neighbouring text already says it (dot becomes decorative). */
  label?: string;
}

export function StatusDot({ status, pulse, label, className, ...rest }: StatusDotProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  return <span className={cn(dotVariants({ status, pulse }), className)} {...a11y} {...rest} />;
}
