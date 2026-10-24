import type { CSSProperties } from "react";
import { cn } from "../lib/cn";
import { TONE_GRADIENT, type Tone } from "./tone";

export interface ProgressBarProps {
  value: number;
  /** Value that equals 100%. Default 100. */
  max?: number;
  tone?: Tone;
  /** Solid colour instead of a tone gradient (e.g. a vendor colour). */
  color?: string;
  size?: "sm" | "lg";
  /** Accessible name, e.g. "70% ngân sách". */
  label: string;
  /** Optional tick (same units as `value`), e.g. the month-end forecast. */
  marker?: number;
  markerLabel?: string;
  className?: string;
}

const pct = (v: number, max: number) => (max > 0 ? Math.min(100, Math.max(0, (v / max) * 100)) : 0);

/** Gradient progress bar. `sm` is 6px (cards), `lg` is 12px with glow (budget). */
export function ProgressBar({
  value,
  max = 100,
  tone = "main",
  color,
  size = "sm",
  label,
  marker,
  markerLabel,
  className,
}: ProgressBarProps) {
  const width = pct(value, max);
  const fill: CSSProperties = { width: `${width}%`, background: color ?? TONE_GRADIENT[tone] };
  const large = size === "lg";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(max, Math.max(0, value))}
      className={cn("relative rounded-full bg-soft-fill", large ? "h-3" : "h-1.5", className)}
    >
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <i
          className={cn(
            "block h-full rounded-full",
            large && tone === "main" && !color && "shadow-[0_3px_8px_rgba(255,0,128,0.3)]",
          )}
          style={fill}
        />
      </div>
      {marker !== undefined ? (
        <u
          title={markerLabel}
          className="absolute -top-1 -bottom-1 w-0.5 rounded-sm bg-soft-navy no-underline"
          style={{ left: `${pct(marker, max)}%` }}
        />
      ) : null}
    </div>
  );
}
