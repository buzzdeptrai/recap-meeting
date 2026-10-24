"use client";

import { cn } from "../lib/cn";
import { defaultLabels } from "../labels";
import { roundedTopRect, smoothBandPath, smoothLinePath, type Point } from "../lib/curve";
import { formatNumber } from "../lib/format";
import { linearScale, niceAxis } from "../lib/scale";
import { stackLayers, totalsOf } from "../lib/stack";
import {
  ChartLegend,
  ChartTooltip,
  GridAndAxes,
  SrDataTable,
  XLabels,
  type TooltipContent,
} from "./chart-parts";
import { useChartCursor, useChartWidth, useSvgId } from "./use-chart";

export interface StackSeries {
  id: string;
  label: string;
  values: ReadonlyArray<number>;
  color: string;
}

export interface StackedBarChartProps {
  /** Bottom-to-top stacking order. Values must be >= 0. */
  series: ReadonlyArray<StackSeries>;
  labels: ReadonlyArray<string>;
  ariaLabel: string;
  /** `bars` (default) or smooth stacked `area` (good for dense daily series). */
  variant?: "bars" | "area";
  height?: number;
  /** Tooltip / data-table number format. */
  formatValue?: (v: number) => string;
  /** Y tick label format (defaults to `formatValue`). */
  formatAxis?: (v: number) => string;
  formatLabel?: (label: string) => string;
  /** Force axis top; useful to keep the scale steady when switching series. */
  max?: number;
  tickCount?: number;
  showLegend?: boolean;
  totalLabel?: string;
  /** Accessible name of the keyboard-focus overlay. */
  keyboardHint?: string;
  initialWidth?: number;
  className?: string;
}

const PAD = { top: 12, bottom: 32, left: 48, right: 8 };
const defaultFormat = (v: number) => formatNumber(v, 2);

/** Stacked series per x position (e.g. cost per vendor per day), as rounded bars or a smooth stacked area. */
export function StackedBarChart({
  series,
  labels,
  ariaLabel,
  variant = "bars",
  height = 280,
  formatValue = defaultFormat,
  formatAxis,
  formatLabel = (l) => l,
  max,
  tickCount = 4,
  showLegend = true,
  totalLabel = defaultLabels.chartTotal,
  keyboardHint = defaultLabels.chartKeyboardHint,
  initialWidth = 720,
  className,
}: StackedBarChartProps) {
  const [ref, w] = useChartWidth(initialWidth);
  const uid = useSvgId();
  const n = labels.length;
  const box = {
    left: PAD.left,
    right: PAD.right,
    top: PAD.top,
    height: height - PAD.top - PAD.bottom,
    width: w - PAD.left - PAD.right,
  };
  const layers = stackLayers(
    series.map((s) => s.values),
    n,
  );
  const totals = totalsOf(
    series.map((s) => s.values),
    n,
  );
  const nice = niceAxis(max ?? Math.max(0, ...totals), tickCount);
  const y = linearScale([0, nice.max], [box.top + box.height, box.top]);
  const baseY = box.top + box.height;
  const band = box.width / Math.max(1, n);
  const area = variant === "area";
  const xAt = (i: number) =>
    area
      ? n <= 1
        ? box.left + box.width / 2
        : box.left + (box.width * i) / (n - 1)
      : box.left + band * i + band / 2;
  const cursor = useChartCursor({ count: n, plotWidth: box.width, mode: area ? "point" : "band" });
  const active = cursor.index;
  const axisFormat = formatAxis ?? formatValue;

  const tooltip: TooltipContent | null =
    active >= 0
      ? {
          title: formatLabel(labels[active] ?? ""),
          rows: series.map((s) => ({
            color: s.color,
            label: s.label,
            value: formatValue(s.values[active] ?? 0),
          })),
          total: { label: totalLabel, value: formatValue(totals[active] ?? 0) },
        }
      : null;

  const barW = Math.max(4, Math.min(28, band * 0.6));
  const pointsOf = (vals: number[]): Point[] => vals.map((v, i) => [xAt(i), y(v)]);

  return (
    <div className={cn("w-full", className)}>
      <div ref={ref} className="relative w-full">
        <svg
          role="img"
          aria-label={ariaLabel}
          viewBox={`0 0 ${w} ${height}`}
          width={w}
          height={height}
          className="block w-full overflow-visible"
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.id} id={`${uid}-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.85} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.55} />
              </linearGradient>
            ))}
          </defs>
          <GridAndAxes box={box} ys={nice.ticks.map(y)} leftLabels={nice.ticks.map(axisFormat)} />
          {area
            ? series.map((s, k) => {
                const layer = layers[k]!;
                const top = pointsOf(layer.top);
                return (
                  <g key={s.id}>
                    <path
                      d={smoothBandPath(top, pointsOf(layer.base))}
                      fill={`url(#${uid}-${s.id})`}
                    />
                    <path
                      d={smoothLinePath(top)}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })
            : labels.map((label, i) => {
                const lastVisible = series.reduce(
                  (acc, s, k) => ((s.values[i] ?? 0) > 0 ? k : acc),
                  -1,
                );
                return (
                  <g key={`${label}-${i}`} opacity={active >= 0 && active !== i ? 0.55 : 1}>
                    {series.map((s, k) => {
                      const { base, top } = layers[k]!;
                      const yTop = y(top[i] ?? 0);
                      const hgt = y(base[i] ?? 0) - yTop;
                      if (hgt <= 0) return null;
                      const x = xAt(i) - barW / 2;
                      return k === lastVisible ? (
                        <path key={s.id} d={roundedTopRect(x, yTop, barW, hgt, 6)} fill={s.color} />
                      ) : (
                        <rect key={s.id} x={x} y={yTop} width={barW} height={hgt} fill={s.color} />
                      );
                    })}
                  </g>
                );
              })}
          <XLabels labels={labels} xAt={xAt} y={height - 8} plotWidth={box.width} />
          {active >= 0 && area ? (
            <line
              x1={xAt(active)}
              x2={xAt(active)}
              y1={box.top}
              y2={baseY}
              stroke="var(--soft-brand)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          ) : null}
        </svg>
        <div
          tabIndex={0}
          role="group"
          aria-label={keyboardHint}
          className="soft-focus absolute rounded-lg"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          {...cursor.handlers}
        />
        <ChartTooltip content={tooltip} x={active >= 0 ? xAt(active) : 0} chartWidth={w} />
        <div className="sr-only" aria-live="polite">
          {tooltip
            ? `${tooltip.title}: ${tooltip.rows.map((r) => `${r.label} ${r.value}`).join(", ")}, ${totalLabel} ${tooltip.total?.value}`
            : ""}
        </div>
      </div>
      {showLegend ? (
        <ChartLegend
          className="mt-4"
          items={series.map((s) => ({ label: s.label, color: s.color }))}
        />
      ) : null}
      <SrDataTable
        caption={ariaLabel}
        labels={labels}
        columns={[
          ...series.map((s) => ({ name: s.label, values: s.values.map(formatValue) })),
          { name: totalLabel, values: totals.map(formatValue) },
        ]}
      />
    </div>
  );
}
