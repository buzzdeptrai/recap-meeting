"use client";

import { useMemo } from "react";
import { cn } from "../lib/cn";
import { defaultLabels } from "../labels";
import { smoothAreaPath, smoothLinePath, type Point } from "../lib/curve";
import { formatNumber } from "../lib/format";
import { linearScale, maxOf, niceAxis } from "../lib/scale";
import {
  ChartLegend,
  ChartTooltip,
  GridAndAxes,
  SrDataTable,
  XLabels,
  type TooltipContent,
} from "./chart-parts";
import { useChartCursor, useChartWidth, useSvgId } from "./use-chart";

export interface LineSeries {
  id: string;
  label: string;
  values: ReadonlyArray<number>;
  color: string;
  /** Which y axis scales this series. Default `left`. */
  axis?: "left" | "right";
  /** Soft gradient fill under the line. Default true. */
  area?: boolean;
  /** Peak opacity of the area gradient (0-1). Default 0.25. */
  areaOpacity?: number;
  /** Tooltip value format (falls back to the axis format). */
  formatValue?: (v: number) => string;
}

export interface AxisConfig {
  /** Force the top of the axis (otherwise nice-rounded from the data). */
  max?: number;
  format?: (v: number) => string;
}

export interface LineAreaChartProps {
  series: ReadonlyArray<LineSeries>;
  /** One label per point (x axis + tooltip title). */
  labels: ReadonlyArray<string>;
  /** Required: summary for assistive tech. */
  ariaLabel: string;
  height?: number;
  axis?: { left?: AxisConfig; right?: AxisConfig };
  /** Fallback number format. */
  formatValue?: (v: number) => string;
  /** Tooltip title from the x label, e.g. `(l) => l + "/2026"`. */
  formatLabel?: (label: string) => string;
  showLegend?: boolean;
  /** Dot on the latest value. Default true. */
  endDots?: boolean;
  /** Tick intervals on the y axes (both axes share it so gridlines align). Default 4. */
  tickCount?: number;
  /** Width used for server rendering / before measuring. */
  /** Accessible name of the keyboard-focus overlay. */
  keyboardHint?: string;
  initialWidth?: number;
  className?: string;
}

const PAD = { top: 12, bottom: 32 };
const defaultFormat = (v: number) => formatNumber(v, 2);

/** Smooth monotone multi-series line chart with soft area fills, optional second y axis, hover and arrow-key cursor. */
export function LineAreaChart({
  series,
  labels,
  ariaLabel,
  height = 360,
  axis,
  formatValue = defaultFormat,
  formatLabel = (l) => l,
  showLegend = false,
  endDots = true,
  tickCount = 4,
  keyboardHint = defaultLabels.chartKeyboardHint,
  initialWidth = 720,
  className,
}: LineAreaChartProps) {
  const [ref, w] = useChartWidth(initialWidth);
  const uid = useSvgId();
  const n = labels.length;
  const hasRight = series.some((s) => s.axis === "right");
  const h = w < 400 ? Math.min(height, 300) : height;
  const box = {
    left: 40,
    right: hasRight ? 44 : 12,
    top: PAD.top,
    height: h - PAD.top - PAD.bottom,
    width: 0,
  };
  box.width = w - box.left - box.right;

  const scales = useMemo(() => {
    const make = (side: "left" | "right", cfg?: AxisConfig) => {
      const data = series
        .filter((s) => (s.axis ?? "left") === side)
        .flatMap((s) => s.values as number[]);
      const nice = niceAxis(cfg?.max ?? maxOf(data), tickCount);
      return {
        nice,
        y: linearScale([0, nice.max], [box.top + box.height, box.top]),
        format: cfg?.format ?? formatValue,
      };
    };
    return { left: make("left", axis?.left), right: make("right", axis?.right) };
  }, [series, axis, tickCount, formatValue, box.top, box.height]);

  const xAt = (i: number) =>
    n <= 1 ? box.left + box.width / 2 : box.left + (box.width * i) / (n - 1);
  const cursor = useChartCursor({ count: n, plotWidth: box.width });
  const active = cursor.index;
  const gridYs = scales.left.nice.ticks.map((t) => scales.left.y(t));
  const baseY = box.top + box.height;

  const tooltip: TooltipContent | null =
    active >= 0
      ? {
          title: formatLabel(labels[active] ?? ""),
          rows: series.map((s) => ({
            color: s.color,
            label: s.label,
            value: (s.formatValue ?? scales[s.axis ?? "left"].format)(s.values[active] ?? 0),
          })),
        }
      : null;

  return (
    <div className={cn("w-full", className)}>
      {showLegend ? (
        <ChartLegend
          className="mb-3"
          items={series.map((s) => ({ label: s.label, color: s.color }))}
        />
      ) : null}
      <div ref={ref} className="relative w-full">
        <svg
          role="img"
          aria-label={ariaLabel}
          viewBox={`0 0 ${w} ${h}`}
          width={w}
          height={h}
          className="block w-full overflow-visible"
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.id} id={`${uid}-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={s.areaOpacity ?? 0.25} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <GridAndAxes
            box={box}
            ys={gridYs}
            leftLabels={scales.left.nice.ticks.map(scales.left.format)}
            rightLabels={hasRight ? scales.right.nice.ticks.map(scales.right.format) : undefined}
          />
          {series.map((s) => {
            const y = scales[s.axis ?? "left"].y;
            const pts: Point[] = s.values.map((v, i) => [xAt(i), y(Number.isFinite(v) ? v : 0)]);
            const last = pts[pts.length - 1];
            return (
              <g key={s.id}>
                {s.area !== false ? (
                  <path d={smoothAreaPath(pts, baseY)} fill={`url(#${uid}-${s.id})`} />
                ) : null}
                <path
                  d={smoothLinePath(pts)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                {endDots && last ? (
                  <circle
                    cx={last[0]}
                    cy={last[1]}
                    r={5}
                    fill="#fff"
                    stroke={s.color}
                    strokeWidth={3}
                  />
                ) : null}
              </g>
            );
          })}
          <XLabels labels={labels} xAt={xAt} y={h - 8} plotWidth={box.width} />
          {active >= 0 ? (
            <g>
              <line
                x1={xAt(active)}
                x2={xAt(active)}
                y1={box.top}
                y2={baseY}
                stroke="var(--soft-brand)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              {series.map((s) => (
                <circle
                  key={s.id}
                  cx={xAt(active)}
                  cy={scales[s.axis ?? "left"].y(s.values[active] ?? 0)}
                  r={4.5}
                  fill="#fff"
                  stroke={s.color}
                  strokeWidth={2.5}
                />
              ))}
            </g>
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
            ? `${tooltip.title}: ${tooltip.rows.map((r) => `${r.label} ${r.value}`).join(", ")}`
            : ""}
        </div>
      </div>
      <SrDataTable
        caption={ariaLabel}
        labels={labels}
        columns={series.map((s) => ({
          name: s.label,
          values: s.values.map((v) => (s.formatValue ?? scales[s.axis ?? "left"].format)(v)),
        }))}
      />
    </div>
  );
}
