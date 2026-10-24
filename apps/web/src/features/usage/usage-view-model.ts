import type { BreakdownRow, ReliabilityRow } from "./breakdown-table";
import type { ChartSeries } from "./usage-chart-card";
import type { UsagePageData } from "./usage-data";
import { isEmptyUsage } from "./usage-data";
import { dayLabel, metricTitle, rangeLabel } from "./usage-format";
import {
  budgetView,
  deltaFromPct,
  keyColor,
  keyLabel,
  metricOf,
  VENDOR_LABEL,
  type BudgetView,
} from "./usage-model";
import type { UsageViewState } from "./usage-url";

export interface MeetingCostRow {
  id: string;
  title: string;
  costUsd: number;
  requests: number;
  audioSeconds: number;
}

const DELTA_KEY = {
  cost: "costUsd",
  seconds: "audioSeconds",
  tokens: "tokens",
  requests: "requests",
} as const;

export interface UsageViewModel {
  empty: boolean;
  /** Costs are examples when any price is unverified or none is configured. */
  estimated: boolean;
  chart: {
    title: string;
    rangeText: string;
    total: number;
    delta: ReturnType<typeof deltaFromPct>;
    labels: string[];
    series: ChartSeries[];
    ariaLabel: string;
  };
  budget: BudgetView;
  pricing: { allVerified: boolean; updatedAt: string | null; unverified: string[] };
  breakdown: BreakdownRow[];
  reliability: ReliabilityRow[];
  meetings: MeetingCostRow[];
}

function buildChart(data: UsagePageData, state: UsageViewState, estimated: boolean) {
  const { summary, series } = data;
  const title = metricTitle(state.metric, estimated);
  const rangeText = rangeLabel(summary.range);
  return {
    title,
    rangeText,
    total: metricOf(state.metric, summary.totals),
    delta: deltaFromPct(summary.deltasPct[DELTA_KEY[state.metric]]),
    labels: series.days.map(dayLabel),
    series: series.series.map((s, i) => ({
      id: s.key,
      label: keyLabel(state.group, s.key),
      values: s.values,
      color: keyColor(state.group, s.key, i),
    })),
    ariaLabel: `Biểu đồ ${title.toLowerCase()} theo ngày, nhóm theo ${state.group}, ${rangeText}`,
  };
}

export function buildUsageViewModel(data: UsagePageData, state: UsageViewState): UsageViewModel {
  const { summary, breakdown, reliability, meetings } = data;
  const estimated = !summary.pricing.allVerified;
  const group = state.group;
  return {
    empty: isEmptyUsage(summary),
    estimated,
    chart: buildChart(data, state, estimated),
    budget: budgetView(summary.budget),
    pricing: summary.pricing,
    breakdown: breakdown.rows.map((r, i) => ({
      ...r,
      id: r.key ?? "none",
      label: keyLabel(group, r.key),
      color: keyColor(group, r.key ?? "", i),
    })),
    reliability: reliability.rows.map((r) => ({
      id: `${r.vendor}/${r.model}`,
      vendor: VENDOR_LABEL[r.vendor] ?? r.vendor,
      model: r.model,
      requests: r.requests,
      errors: r.errors,
      errorRate: r.errorRate,
      fallbackRate: r.fallbackRate,
      p50Ms: r.latency.p50Ms,
      p95Ms: r.latency.p95Ms,
    })),
    meetings: meetings.meetings.map((m) => ({
      id: m.meetingId,
      title: m.title ?? "Cuộc họp đã xóa",
      costUsd: m.costUsd,
      requests: m.requests,
      audioSeconds: m.audioSeconds,
    })),
  };
}
