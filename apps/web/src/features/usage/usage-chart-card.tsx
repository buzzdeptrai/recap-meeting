"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Card, SegmentedControl, StackedBarChart, type DeltaInfo } from "@recap/admin-ui";
import { metricFormat } from "./usage-format";
import {
  METRICS,
  METRIC_LABELS,
  usageHref,
  type MetricKey,
  type UsageViewState,
} from "./usage-url";

export interface ChartSeries {
  id: string;
  label: string;
  values: number[];
  color: string;
}

export interface UsageChartCardProps {
  state: UsageViewState;
  title: string;
  rangeText: string;
  total: number;
  delta: DeltaInfo | null;
  deltaLabel: string;
  labels: string[];
  series: ChartSeries[];
  ariaLabel: string;
}

const DELTA_COLOR = { up: "text-soft-ok", down: "text-soft-bad", flat: "text-soft-muted" } as const;

/** Headline total, metric tabs and the stacked chart. The metric lives in the URL. */
export function UsageChartCard(props: UsageChartCardProps) {
  const { state, title, rangeText, total, delta, deltaLabel, labels, series, ariaLabel } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fmt = metricFormat(state.metric);
  return (
    <Card as="section" aria-labelledby="usage-head" className="col-span-8 max-[1100px]:col-span-12">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p id="usage-head" className="text-[13px] font-semibold text-soft-muted">
            {title} · {rangeText}
          </p>
          <div className="soft-tabular text-[32px] leading-tight font-bold tracking-[-0.02em] max-[640px]:text-[28px]">
            {fmt.value(total)}
          </div>
          <p className="mt-1 text-[13px] text-soft-muted">
            {delta ? <b className={DELTA_COLOR[delta.direction]}>{delta.text}</b> : null}{" "}
            {delta ? deltaLabel : "Chưa có kỳ trước để so sánh"}
          </p>
        </div>
        <SegmentedControl
          variant="tabs"
          ariaLabel="Chỉ số"
          value={state.metric}
          onValueChange={(metric: MetricKey) =>
            startTransition(() => router.push(usageHref({ ...state, metric })))
          }
          options={METRICS.map((value) => ({ value, label: METRIC_LABELS[value] }))}
        />
      </div>
      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <StackedBarChart
          variant="area"
          ariaLabel={ariaLabel}
          labels={labels}
          series={series}
          formatValue={fmt.value}
          formatAxis={fmt.axis}
        />
      </div>
    </Card>
  );
}
