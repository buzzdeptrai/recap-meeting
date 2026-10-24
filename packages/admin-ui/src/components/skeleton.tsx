import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/** Loading placeholder; size it with className (`h-6 w-32`). Decorative, hidden from assistive tech. */
export function Skeleton({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-lg bg-soft-fill motion-safe:animate-pulse", className)}
      {...rest}
    />
  );
}
