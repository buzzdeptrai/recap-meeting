import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/** Keyboard key hint, e.g. the "/" that focuses search or "K" that marks a conclusion. */
export function Kbd({ className, ...rest }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md bg-soft-fill px-1 font-soft-mono text-[11px] font-bold text-soft-muted",
        className,
      )}
      {...rest}
    />
  );
}
