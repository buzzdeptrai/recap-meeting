import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const bodyPadding = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-8",
} as const;

const floatCardVariants = cva(
  "flex min-h-0 min-w-0 flex-col rounded-soft-card border border-soft-line-strong bg-soft-surface text-soft-ink shadow-soft-card",
  {
    variants: {
      /** Clip children to the rounded corners (scroll containers, edge-to-edge media). */
      clip: { true: "overflow-hidden", false: "" },
    },
    defaultVariants: { clip: false },
  },
);

export interface FloatCardProps
  extends Omit<ComponentProps<"div">, "title">, VariantProps<typeof floatCardVariants> {
  as?: "div" | "section" | "article" | "aside" | "header";
  /** Padding of the body area (default `md`). Header and footer keep their own padding. */
  padding?: keyof typeof bodyPadding;
  /** Slot above the body (title row, status strip). */
  header?: ReactNode;
  /** Slot below the body (action row). */
  footer?: ReactNode;
  /** Extra classes for the body wrapper, e.g. `overflow-y-auto` for a scrolling panel. */
  bodyClassName?: string;
}

/** Floating panel: 24px radius, 1px strong hairline, soft card shadow. Body grows; header/footer stay put. */
export function FloatCard({
  as: Tag = "div",
  padding = "md",
  clip,
  header,
  footer,
  bodyClassName,
  className,
  children,
  ...rest
}: FloatCardProps) {
  return (
    <Tag className={cn(floatCardVariants({ clip }), className)} {...rest}>
      {header ? <div className="shrink-0 px-4 pt-4 sm:px-5 sm:pt-5">{header}</div> : null}
      <div className={cn("min-h-0 flex-1", bodyPadding[padding], bodyClassName)}>{children}</div>
      {footer ? <div className="shrink-0 px-4 pb-4 sm:px-5 sm:pb-5">{footer}</div> : null}
    </Tag>
  );
}
