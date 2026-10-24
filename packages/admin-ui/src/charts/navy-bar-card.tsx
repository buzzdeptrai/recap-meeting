"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { defaultLabels } from "../labels";
import { formatNumber } from "../lib/format";
import { linearScale, niceAxis, stepDecimals } from "../lib/scale";
import {
  ChartTooltip,
  GridAndAxes,
  SrDataTable,
  XLabels,
  type TooltipContent,
} from "./chart-parts";
import { useChartCursor, useChartWidth } from "./use-chart";

export interface NavyBarCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  values: ReadonlyArray<number>;
  labels: ReadonlyArray<string>;
  /** Summary for assistive tech. */
  ariaLabel: string;
  /** Tooltip / data-table number format. */
  formatValue?: (v: number) => string;
  formatAxis?: (v: number) => string;
  /** Tooltip title from the x label. */
  formatLabel?: (label: string) => string;
  /** Name of the measure in the tooltip, e.g. "Giờ chép lời". */
  seriesLabel?: string;
  height?: number;
  tickCount?: number;
  /** Accessible name of the keyboard-focus overlay. */
  keyboardHint?: string;
  initialWidth?: number;
  className?: string;
}

const PAD = { top: 8, bottom: 28, left: 28, right: 4 };
const defaultFormat = (v: number) => formatNumber(v, 1);

/** Dark gradient panel with rounded white bars. Drop it inside a `Card` (as the v3 dashboard does) or on its own. */
export function NavyBarCard({
  title,
  subtitle,
  values,
  labels,
  ariaLabel,
  formatValue = defaultFormat,
  formatAxis,
  formatLabel = (l) => l,
  seriesLabel = "",
  height = 220,
  tickCount = 4,
  keyboardHint = defaultLabels.chartKeyboardHint,
  initialWidth = 460,
  className,
}: NavyBarCardProps) {
  const [ref, w] = useChartWidth(initialWidth);
  const n = labels.length;
  const box = {
    left: PAD.left,
    right: PAD.right,
    top: PAD.top,
    height: height - PAD.top - PAD.bottom,
    width: w - PAD.left - PAD.right,
  };
  const nice = niceAxis(Math.max(0, ...values), tickCount);
  const y = linearScale([0, nice.max], [box.top + box.height, box.top]);
  const band = box.width / Math.max(1, n);
  const barW = Math.max(5, Math.min(14, band * 0.56));
  const xAt = (i: number) => box.left + band * i + band / 2;
  const cursor = useChartCursor({ count: n, plotWidth: box.width, mode: "band" });
  const active = cursor.index;

  const tooltip: TooltipContent | null =
    active >= 0
      ? {
          title: formatLabel(labels[active] ?? ""),
          rows: [
            {
              color: "#7928CA",
              label: seriesLabel || String(title),
              value: formatValue(values[active] ?? 0),
            },
          ],
        }
      : null;

  return (
    <section
      className={cn(
        "rounded-[14px] bg-soft-dark px-4 pt-4 pb-3 text-white shadow-[0_4px_12px_rgba(20,23,39,0.25)]",
        className,
      )}
    >
      <h2 className="text-base font-bold">{title}</h2>
      {subtitle ? (
        <p className="mt-0.5 mb-4 text-[13px] opacity-80">{subtitle}</p>
      ) : (
        <div className="mb-4" />
      )}
      <div ref={ref} className="relative w-full text-soft-ink">
        <svg
          role="img"
          aria-label={ariaLabel}
          viewBox={`0 0 ${w} ${height}`}
          width={w}
          height={height}
          className="block w-full overflow-visible"
        >
          <GridAndAxes
            box={box}
            ys={nice.ticks.map(y)}
            leftLabels={nice.ticks.map(
              formatAxis ?? ((v) => formatNumber(v, stepDecimals(nice.step))),
            )}
            onDark
          />
          {values.map((v, i) => {
            const hgt = v > 0 ? Math.max(4, y(0) - y(v)) : 0;
            if (!hgt) return null;
            return (
              <rect
                key={`${labels[i]}-${i}`}
                x={xAt(i) - barW / 2}
                y={y(0) - hgt}
                width={barW}
                height={hgt}
                rx={barW / 2}
                fill="#fff"
                opacity={active >= 0 && active !== i ? 0.55 : 0.95}
              />
            );
          })}
          <XLabels labels={labels} xAt={xAt} y={height - 6} plotWidth={box.width} onDark />
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
          {tooltip ? `${tooltip.title}: ${tooltip.rows[0]?.value}` : ""}
        </div>
      </div>
      <SrDataTable
        caption={ariaLabel}
        labels={labels}
        columns={[{ name: seriesLabel || String(title), values: values.map(formatValue) }]}
      />
    </section>
  );
}
