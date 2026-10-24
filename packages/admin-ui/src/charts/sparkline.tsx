import { smoothAreaPath, smoothLinePath, type Point } from "../lib/curve";
import { useId } from "react";

export interface SparklineProps {
  values: ReadonlyArray<number>;
  color?: string;
  width?: number;
  height?: number;
  /** Fill under the line. Default true. */
  area?: boolean;
  /** Accessible summary; without it the sparkline is decorative (`aria-hidden`). */
  ariaLabel?: string;
  className?: string;
}

/** Tiny trend line for tables and stat cards. Scales 0..max (or min..max when `values` never touch 0 by a wide margin). */
export function Sparkline({
  values,
  color = "var(--soft-purple)",
  width = 120,
  height = 32,
  area = true,
  ariaLabel,
  className,
}: SparklineProps) {
  const uid = `sp${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const pad = 3;
  const finite = values.filter(Number.isFinite);
  const lo = Math.min(0, ...finite);
  const hi = Math.max(...finite, lo + 1e-9);
  const n = values.length;
  const pts: Point[] = values.map((v, i) => [
    n <= 1 ? width / 2 : pad + ((width - pad * 2) * i) / (n - 1),
    height - pad - ((Number.isFinite(v) ? v - lo : 0) / (hi - lo)) * (height - pad * 2),
  ]);
  const a11y = ariaLabel
    ? { role: "img", "aria-label": ariaLabel }
    : { "aria-hidden": true as const };
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      {...a11y}
    >
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {area && pts.length > 1 ? (
        <path d={smoothAreaPath(pts, height - pad)} fill={`url(#${uid})`} />
      ) : null}
      <path
        d={smoothLinePath(pts)}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}
