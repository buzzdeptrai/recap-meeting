import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { labelIndices } from "../lib/scale";

export interface LegendItem {
  label: string;
  color: string;
}

export function ChartLegend({
  items,
  className,
  onDark,
}: {
  items: ReadonlyArray<LegendItem>;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <ul
      className={cn(
        "flex flex-wrap gap-4 text-xs font-semibold",
        onDark ? "text-white/80" : "text-soft-muted",
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.label} className="flex items-center">
          <i
            aria-hidden="true"
            className="mr-1.5 inline-block size-2.5 rounded-full"
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export interface TooltipRow {
  color: string;
  label: string;
  value: string;
}

export interface TooltipContent {
  title: string;
  rows: ReadonlyArray<TooltipRow>;
  total?: { label: string; value: string };
}

/** Floating readout. `x` is the anchor in chart pixels; it flips to the left near the right edge. */
export function ChartTooltip({
  content,
  x,
  chartWidth,
  top = 8,
}: {
  content: TooltipContent | null;
  x: number;
  chartWidth: number;
  top?: number;
}) {
  if (!content) return null;
  const flip = x + 14 + 176 > chartWidth;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 min-w-[150px] rounded-xl bg-soft-surface px-3 py-2 text-xs text-soft-muted shadow-soft-pop"
      style={{ left: Math.max(0, flip ? x - 14 - 176 : x + 14), top }}
    >
      <b className="mb-1 block text-soft-ink">{content.title}</b>
      {content.rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-4">
          <span>
            <i
              className="mr-1.5 inline-block size-2 rounded-full"
              style={{ background: r.color }}
            />
            {r.label}
          </span>
          <span className="soft-tabular font-soft-mono font-semibold text-soft-ink">{r.value}</span>
        </div>
      ))}
      {content.total ? (
        <div className="mt-1 flex justify-between gap-4 border-t border-soft-line pt-1">
          <span>{content.total.label}</span>
          <span className="soft-tabular font-soft-mono font-semibold text-soft-ink">
            {content.total.value}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Screen-reader data fallback: the same numbers as a real table. */
export function SrDataTable({
  caption,
  labels,
  columns,
}: {
  caption: string;
  labels: ReadonlyArray<string>;
  columns: ReadonlyArray<{ name: string; values: ReadonlyArray<string> }>;
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col" />
          {columns.map((c) => (
            <th key={c.name} scope="col">
              {c.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((label, i) => (
          <tr key={`${label}-${i}`}>
            <th scope="row">{label}</th>
            {columns.map((c) => (
              <td key={c.name}>{c.values[i] ?? ""}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface AxisBox {
  left: number;
  right: number;
  top: number;
  height: number;
  width: number;
}

/** Dashed horizontal gridlines + left (and optional right) tick labels. `ys` are pixel rows. */
export function GridAndAxes({
  box,
  ys,
  leftLabels,
  rightLabels,
  onDark,
}: {
  box: AxisBox;
  ys: ReadonlyArray<number>;
  leftLabels: ReadonlyArray<string>;
  rightLabels?: ReadonlyArray<string>;
  onDark?: boolean;
}) {
  const text = onDark ? "fill-white/70" : "fill-soft-muted";
  return (
    <g>
      {ys.map((y, i) => (
        <g key={i}>
          <line
            x1={box.left}
            x2={box.left + box.width}
            y1={y}
            y2={y}
            strokeDasharray="3 5"
            strokeWidth={1}
            stroke={onDark ? "rgba(255,255,255,0.18)" : "var(--soft-grid)"}
          />
          <text x={box.left - 10} y={y + 4} textAnchor="end" className={cn("text-[11px]", text)}>
            {leftLabels[i]}
          </text>
          {rightLabels ? (
            <text
              x={box.left + box.width + 10}
              y={y + 4}
              textAnchor="start"
              className={cn("text-[11px]", text)}
            >
              {rightLabels[i]}
            </text>
          ) : null}
        </g>
      ))}
    </g>
  );
}

/** X labels thinned to fit; `xAt(i)` gives the pixel x for data index i. */
export function XLabels({
  labels,
  xAt,
  y,
  plotWidth,
  onDark,
}: {
  labels: ReadonlyArray<string>;
  xAt: (i: number) => number;
  y: number;
  plotWidth: number;
  onDark?: boolean;
}): ReactNode {
  return labelIndices(labels.length, plotWidth).map((i) => (
    <text
      key={i}
      x={xAt(i)}
      y={y}
      textAnchor="middle"
      className={cn("text-[11px]", onDark ? "fill-white/70" : "fill-soft-muted")}
    >
      {labels[i]}
    </text>
  ));
}
