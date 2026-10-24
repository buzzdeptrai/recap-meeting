import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

const POSITION = {
  /** Pinned inside the nearest `relative` parent (a scroll panel). */
  absolute: "absolute inset-x-0",
  /** Sticks to the bottom of its scroll container. */
  sticky: "sticky",
  /** Pinned to the viewport. */
  fixed: "fixed inset-x-0",
} as const;

const BOTTOM = { sm: "bottom-3", md: "bottom-[18px]", lg: "bottom-8" } as const;
const ALIGN = { center: "items-center", start: "items-start", end: "items-end" } as const;

export interface FloatingActionBarProps extends Omit<ComponentProps<"div">, "children"> {
  /** Names the toolbar for assistive tech. */
  ariaLabel: string;
  /** The buttons: `Button variant="outline" shape="pill"` with an optional `Kbd`. */
  children: ReactNode;
  position?: keyof typeof POSITION;
  align?: keyof typeof ALIGN;
  /** Distance from the bottom edge. */
  bottom?: keyof typeof BOTTOM;
  /** Small caption under the bar, e.g. why the buttons are disabled. */
  hint?: ReactNode;
  /** Hide the keyboard-hint children below 640px (apply `data-kbd` or use `Kbd`). Default true. */
  hideKbdOnMobile?: boolean;
}

/** Pill-shaped bar floating at the bottom of a panel. The wrapper ignores pointer events so content behind stays usable. */
export function FloatingActionBar({
  ariaLabel,
  children,
  position = "absolute",
  align = "center",
  bottom = "md",
  hint,
  hideKbdOnMobile = true,
  className,
  ...rest
}: FloatingActionBarProps) {
  return (
    <div
      className={cn(
        "pointer-events-none z-10 flex flex-col gap-2 px-4",
        POSITION[position],
        BOTTOM[bottom],
        ALIGN[align],
        className,
      )}
      {...rest}
    >
      <div
        role="toolbar"
        aria-label={ariaLabel}
        className={cn(
          "pointer-events-auto inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-soft-pill bg-soft-surface p-2 shadow-soft-float",
          hideKbdOnMobile && "max-[639px]:[&_kbd]:hidden",
        )}
      >
        {children}
      </div>
      {hint ? (
        <p className="pointer-events-auto rounded-soft-pill bg-soft-surface px-3.5 py-1 text-center text-[12.5px] text-soft-muted shadow-soft-card">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
