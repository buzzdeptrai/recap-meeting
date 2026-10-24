import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

export const chipVariants = cva(
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-soft-pill font-semibold [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-soft-inset-2 text-soft-muted",
        /** Low-key label on a coloured bubble (language tags). */
        outline: "bg-soft-surface text-soft-muted shadow-[inset_0_0_0_1px_var(--soft-line-strong)]",
        info: "bg-soft-accent-soft text-soft-accent-ink",
        ok: "bg-soft-ok-bg text-soft-ok-ink",
        warn: "bg-soft-olive-bg text-soft-olive-ink shadow-[inset_0_0_0_1px_var(--soft-olive-line)]",
        /** Conclusions / decisions only (amber). */
        decision:
          "bg-soft-conclusion-bg text-soft-conclusion shadow-[inset_0_0_0_1px_var(--soft-conclusion-line)]",
        danger: "bg-soft-danger-bg text-soft-danger-ink",
      },
      size: {
        sm: "h-[18px] gap-1 px-2 text-[11px] [&_svg]:size-3",
        md: "h-6 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5",
        lg: "h-[30px] gap-2 px-3 text-[13px] [&_svg]:size-4",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export interface ChipProps extends ComponentProps<"span">, VariantProps<typeof chipVariants> {
  /** Leading icon (decorative). */
  icon?: ReactNode;
}

/** Small rounded label. Colour is never the only cue: always pass text. */
export function Chip({ tone, size, icon, className, children, ...rest }: ChipProps) {
  return (
    <span className={cn(chipVariants({ tone, size }), className)} {...rest}>
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
