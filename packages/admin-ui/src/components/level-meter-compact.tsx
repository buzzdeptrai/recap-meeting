import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { IconBadge } from "./icon-badge";
import { ROW_TONE_BAR, type RowTone } from "./tone-ab";

export interface CompactLevelMeterProps {
  /** Lit share, 0..bars. */
  lit: number;
  bars: number;
  label: string;
  statusText?: string;
  statusTone?: "muted" | "ok";
  icon?: ReactNode;
  tone: RowTone;
  disabled: boolean;
  className?: string;
}

/** Horizontal level track with a round icon, visible label and status text (see `LevelMeter variant="compact"`). */
export function CompactLevelMeter({
  lit,
  bars,
  label,
  statusText,
  statusTone = "muted",
  icon,
  tone,
  disabled,
  className,
}: CompactLevelMeterProps) {
  const share = bars > 0 ? (lit / bars) * 100 : 0;
  return (
    <div className={cn("flex items-center gap-2.5 text-[13px]", className)}>
      {icon ? (
        <IconBadge tone={disabled ? "neutral" : tone} size="sm">
          {icon}
        </IconBadge>
      ) : null}
      <span className="font-semibold text-soft-ink">{label}</span>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={bars}
        aria-valuenow={lit}
        aria-valuetext={statusText}
        className="h-2 w-[84px] shrink-0 overflow-hidden rounded-soft-pill bg-soft-inset-2 max-[639px]:flex-1"
      >
        <div
          className={cn(
            "h-full rounded-soft-pill transition-[width] duration-150",
            disabled ? "bg-soft-faint opacity-50" : ROW_TONE_BAR[tone],
          )}
          style={{ width: `${share}%` }}
        />
      </div>
      {statusText ? (
        <span
          className={cn(
            "text-xs",
            statusTone === "ok" && !disabled ? "font-semibold text-soft-ok-ink" : "text-soft-muted",
          )}
        >
          {statusText}
        </span>
      ) : null}
    </div>
  );
}
