import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { ROW_TONE_CHIP, type RowTone } from "./tone-ab";

const iconBadgeVariants = cva("grid shrink-0 place-items-center rounded-full", {
  variants: {
    size: {
      sm: "size-7 [&_svg]:size-4",
      md: "size-[34px] [&_svg]:size-[18px]",
      lg: "size-10 [&_svg]:size-5",
    },
  },
  defaultVariants: { size: "md" },
});

export interface IconBadgeProps
  extends ComponentProps<"span">, VariantProps<typeof iconBadgeVariants> {
  tone?: RowTone;
}

/** Round tinted icon holder (decorative: `aria-hidden`). Put the icon as the child. */
export function IconBadge({ tone = "neutral", size, className, ...rest }: IconBadgeProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(iconBadgeVariants({ size }), ROW_TONE_CHIP[tone], className)}
      {...rest}
    />
  );
}
