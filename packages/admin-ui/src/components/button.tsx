"use client";

import type { ComponentProps, ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { buttonVariants } from "./button-variants";

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. `next/link`) with button styling. */
  asChild?: boolean;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Leading icon (16px); replaced by the spinner while `loading`. */
  icon?: ReactNode;
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 motion-safe:animate-spin"
      fill="none"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Button({
  variant,
  size,
  shape,
  asChild,
  loading,
  icon,
  disabled,
  className,
  children,
  type,
  ...rest
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, shape }), className);
  if (asChild)
    return (
      <Slot className={classes} {...rest}>
        {children}
      </Slot>
    );
  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}
