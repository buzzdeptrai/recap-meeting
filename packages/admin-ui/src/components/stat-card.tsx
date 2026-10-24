import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import type { DeltaInfo } from "../lib/format";
import { Card } from "./card";
import { IconTile } from "./icon-tile";
import { ProgressBar } from "./progress-bar";
import type { Tone } from "./tone";

const DELTA_CLASS: Record<DeltaInfo["direction"], string> = {
  up: "text-soft-ok",
  down: "text-soft-bad",
  flat: "text-soft-muted",
};

export interface StatCardProps {
  label: ReactNode;
  /** The big number, already formatted (use `formatNumber`, `formatUsd`, ...). */
  value: ReactNode;
  /** Small unit after the number, e.g. "triệu". */
  unit?: ReactNode;
  /** Change vs previous period (see `formatDelta`). `up` is green, `down` red. */
  delta?: DeltaInfo | null;
  /** Text after the delta, e.g. "so với T9". Also usable alone as a footnote. */
  deltaLabel?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  /** Thin gradient bar under the figure (e.g. budget used). */
  progress?: { value: number; max?: number; label: string };
  className?: string;
}

/** KPI card: label, big tabular number, delta line, gradient icon tile, optional progress. */
export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  icon,
  tone = "main",
  progress,
  className,
}: StatCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-soft-muted">{label}</div>
          <div className="soft-tabular mt-1 text-2xl leading-[1.3] font-bold tracking-[-0.02em] text-soft-ink">
            {value}
            {unit ? (
              <small className="ml-1 text-sm font-semibold tracking-normal text-soft-muted">
                {unit}
              </small>
            ) : null}
          </div>
          {delta || deltaLabel ? (
            <div className="mt-1 text-[13px] leading-normal text-soft-muted">
              {delta ? (
                <span className={cn("block font-bold", DELTA_CLASS[delta.direction])}>
                  {delta.text}
                </span>
              ) : null}
              {deltaLabel ? <span className="block">{deltaLabel}</span> : null}
            </div>
          ) : null}
        </div>
        {icon ? <IconTile tone={tone}>{icon}</IconTile> : null}
      </div>
      {progress ? (
        <ProgressBar
          className="mt-3"
          tone="main"
          value={progress.value}
          max={progress.max}
          label={progress.label}
        />
      ) : null}
    </Card>
  );
}

export interface MiniStatProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  /** 0-100 share bar. */
  progress?: { value: number; label: string };
}

/** Compact stat (small tile + label, number, thin bar) for 2x2 grids under a chart. */
export function MiniStat({ label, value, icon, tone = "main", progress }: MiniStatProps) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-xs font-semibold text-soft-muted">
        {icon ? (
          <IconTile size="sm" tone={tone}>
            {icon}
          </IconTile>
        ) : null}
        {label}
      </div>
      <div className="soft-tabular my-2 text-base font-bold tracking-[-0.01em] text-soft-ink">
        {value}
      </div>
      {progress ? <ProgressBar tone={tone} value={progress.value} label={progress.label} /> : null}
    </div>
  );
}
