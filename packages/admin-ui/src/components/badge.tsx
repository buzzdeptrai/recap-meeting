import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const badgeVariants = cva("inline-flex items-center whitespace-nowrap font-bold", {
  variants: {
    variant: {
      neutral: "bg-soft-fill text-soft-navy",
      ok: "bg-[#e6f7ea] text-[#117a28]",
      rec: "bg-[#ffe5f1] text-[#b3005a]",
      warn: "bg-[#fff3d6] text-[#8a5b00]",
      error: "bg-[#fde4e4] text-[#a30606]",
      purple: "bg-[#f3e8fd] text-[#6b21a8]",
      cyan: "bg-[#e3f6fd] text-[#0b6c8c]",
      /** Conclusions / decisions only (minutes, room). */
      conclusion: "bg-soft-conclusion-bg text-soft-conclusion",
    },
    shape: {
      /** Status badge. */
      pill: "rounded-full px-2.5 py-[3px] text-xs",
      /** Compact tag (language chips). */
      chip: "rounded-lg px-2 py-0.5 text-[11px]",
    },
  },
  defaultVariants: { variant: "neutral", shape: "pill" },
});

export interface BadgeProps extends ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  /** Leading status dot in the badge colour (decorative; the text carries the meaning). */
  dot?: boolean;
}

export function Badge({ variant, shape, dot, className, children, ...rest }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, shape }), dot && "gap-1.5", className)} {...rest}>
      {dot ? (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}

/** Small purple pill, e.g. "ví dụ" next to estimated figures. */
export function Pill({ className, ...rest }: ComponentProps<"span">) {
  return (
    <Badge
      variant="purple"
      shape="pill"
      className={cn("px-2 py-0.5 text-[11px]", className)}
      {...rest}
    />
  );
}
