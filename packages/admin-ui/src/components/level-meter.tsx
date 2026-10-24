import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { CompactLevelMeter } from "./level-meter-compact";
import type { RowTone } from "./tone-ab";

export interface LevelMeterProps {
  /** Lit bars, 0..bars. */
  value: number;
  /** Bar count (default 8). */
  bars?: number;
  label: string;
  /** No signal source: bars stay unlit. */
  disabled?: boolean;
  className?: string;
  /** `bars` (default): vertical bars, label only for assistive tech. `compact`: icon + visible label + track + status text. */
  variant?: "bars" | "compact";
  /** compact: text after the track ("ổn", "không có tín hiệu"). */
  statusText?: string;
  /** compact: `ok` renders the status text bold green. */
  statusTone?: "muted" | "ok";
  /** compact: leading round icon. */
  icon?: ReactNode;
  /** compact: fill and icon tint (`tone-a` / `tone-b` / `neutral`). */
  tone?: RowTone;
}

/** Fixed-width bar meter; the top bar turns amber to warn about clipping. Pure presentational. */
export function LevelMeter({
  value,
  bars = 8,
  label,
  disabled = false,
  className,
  variant = "bars",
  statusText,
  statusTone,
  icon,
  tone = "tone-a",
}: LevelMeterProps) {
  const lit = disabled ? 0 : Math.max(0, Math.min(bars, Math.round(value)));
  if (variant === "compact") {
    return (
      <CompactLevelMeter
        {...{ lit, bars, label, statusText, statusTone, icon, tone, disabled, className }}
      />
    );
  }
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={bars}
      aria-valuenow={lit}
      className={cn("flex h-4 items-end gap-0.5", className)}
    >
      {Array.from({ length: bars }, (_, index) => (
        <span
          key={index}
          className={cn(
            "w-[3px] rounded-full",
            index < lit ? (index === bars - 1 ? "bg-soft-warn" : "bg-soft-ok") : "bg-soft-line",
          )}
          style={{ height: `${6 + index * 1.5}px` }}
        />
      ))}
    </div>
  );
}
