"use client";

import type { ComponentProps, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { iconButtonVariants } from "./icon-button-variants";
import { Tooltip } from "./tooltip";

export interface IconButtonProps
  extends Omit<ComponentProps<"button">, "children">, VariantProps<typeof iconButtonVariants> {
  /** Accessible name; also the tooltip text. Icon-only buttons must have one. */
  label: string;
  icon: ReactNode;
  /** Suppress the tooltip when the surrounding UI already shows the label. */
  tooltip?: boolean;
}

/** Ghost icon-only button with a tooltip and a visible keyboard focus ring. */
export function IconButton({
  label,
  icon,
  size,
  tone,
  tooltip = true,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const button = (
    <button
      type={type}
      aria-label={label}
      className={cn(iconButtonVariants({ size, tone }), className)}
      {...rest}
    >
      {icon}
    </button>
  );
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
}
