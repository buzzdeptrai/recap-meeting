"use client";

import {
  DataTable,
  formatDuration,
  formatNumber,
  formatPercent,
  formatUsd,
  ProgressBar,
  StatusDot,
  Tooltip,
  formatMs,
  type DataColumn,
} from "@recap/admin-ui";
import { Info } from "@phosphor-icons/react";
import type { Sums } from "./usage-model";
import { serviceHealth } from "./usage-model";

export interface BreakdownRow extends Sums {
  id: string;
  label: string;
  sublabel?: string;
  color: string;
  costShare: number;
}

const DASH = <span className="text-[#a0a8b8]">–</span>;
const CHANNEL_NOTE =
  "Deepgram tính tiền riêng từng kênh âm thanh: bản ghi hai kênh (micro và âm thanh hệ thống) được tính gấp đôi thời gian thực.";

function ChannelHeader() {
  return (
    <span className="inline-flex items-center gap-1">
      Chép lời (giờ kênh)
      <Tooltip content={CHANNEL_NOTE}>
        {/* Not a <button>: the header already sits inside the sort button (nested buttons are invalid). */}
        <span className="rounded-full text-soft-muted" aria-hidden="true">
          <Info size={14} />
        </span>
      </Tooltip>
    </span>
  );
}

const nameColumn: DataColumn<BreakdownRow> = {
  key: "label",
  header: "Nhóm",
  sortable: true,
  cell: (r) => (
    <span className="flex items-center gap-3 font-semibold">
      <i className="size-3 shrink-0 rounded-full" style={{ background: r.color }} />
      <span className="min-w-0">
        {r.label}
        {r.sublabel ? (
          <small className="block text-[11px] font-normal text-soft-muted">{r.sublabel}</small>
        ) : null}
      </span>
    </span>
  ),
};

const secondsColumn: DataColumn<BreakdownRow> = {
  key: "audioSeconds",
  header: <ChannelHeader />,
  numeric: true,
  sortable: true,
  cell: (r) =>
    r.audioSeconds > 0 ? (
      <>
        {formatDuration(r.audioSeconds)}
        <small className="block font-soft text-[11px] font-normal text-soft-muted">
          {formatNumber(r.audioSeconds / 60)} phút kênh
        </small>
      </>
    ) : (
      DASH
    ),
};

const countColumn = (
  key: "inputTokens" | "outputTokens",
  header: string,
): DataColumn<BreakdownRow> => ({
  key,
  header,
  numeric: true,
  sortable: true,
  cell: (r) => (r[key] ? formatNumber(r[key]) : DASH),
});

const shareColumn: DataColumn<BreakdownRow> = {
  key: "costShare",
  header: "Tỉ trọng",
  numeric: true,
  sortable: true,
  cell: (r) => {
    const pct = r.costShare * 100;
    return (
      <span className="inline-flex items-center gap-2">
        <ProgressBar
          className="w-24"
          color={r.color}
          value={pct}
          label={`${r.label} ${formatPercent(pct, { decimals: 0 })}`}
        />
        <span className="w-9 text-right">{formatPercent(pct, { decimals: 0 })}</span>
      </span>
    );
  },
};

function columns(estimated: boolean): DataColumn<BreakdownRow>[] {
  return [
    nameColumn,
    secondsColumn,
    countColumn("inputTokens", "Token vào"),
    countColumn("outputTokens", "Token ra"),
    {
      key: "requests",
      header: "Lượt gọi",
      numeric: true,
      sortable: true,
      cell: (r) => formatNumber(r.requests),
    },
    {
      key: "costUsd",
      header: estimated ? "Chi phí (ví dụ)" : "Chi phí ước tính",
      numeric: true,
      sortable: true,
      highlight: true,
      cell: (r) => formatUsd(r.costUsd),
    },
    shareColumn,
  ];
}

export function BreakdownTable({
  rows,
  totals,
  estimated,
  caption,
}: {
  rows: BreakdownRow[];
  totals: Sums;
  estimated: boolean;
  caption: string;
}) {
  return (
    <DataTable
      caption={caption}
      columns={columns(estimated)}
      rows={rows}
      rowKey={(r) => r.id}
      minWidth={760}
      defaultSort={{ key: "costUsd", direction: "desc" }}
      empty="Chưa có dòng nào trong khoảng thời gian này."
      footer={{
        label: "Tổng",
        audioSeconds: totals.audioSeconds > 0 ? formatDuration(totals.audioSeconds) : "–",
        inputTokens: formatNumber(totals.inputTokens),
        outputTokens: formatNumber(totals.outputTokens),
        requests: formatNumber(totals.requests),
        costUsd: formatUsd(totals.costUsd),
      }}
    />
  );
}

export interface ReliabilityRow {
  id: string;
  vendor: string;
  model: string;
  requests: number;
  errors: number;
  errorRate: number;
  fallbackRate: number;
  p50Ms: number | null;
  p95Ms: number | null;
}

const ms = (v: number | null) => (v === null ? DASH : formatMs(v));

const RELIABILITY_COLUMNS: DataColumn<ReliabilityRow>[] = [
  {
    key: "vendor",
    header: "Dịch vụ",
    sortable: true,
    cell: (r) => (
      <span className="flex items-center gap-3 font-semibold">
        <StatusDot
          status={serviceHealth(r.requests, r.errorRate).status}
          label={serviceHealth(r.requests, r.errorRate).label}
        />
        <span>
          {r.vendor}
          <small className="block text-[11px] font-normal text-soft-muted">{r.model}</small>
        </span>
      </span>
    ),
  },
  {
    key: "requests",
    header: "Lượt gọi",
    numeric: true,
    sortable: true,
    cell: (r) => formatNumber(r.requests),
  },
  {
    key: "errorRate",
    header: "Lỗi",
    numeric: true,
    sortable: true,
    cell: (r) => formatPercent(r.errorRate * 100),
  },
  {
    key: "fallbackRate",
    header: "Dự phòng",
    numeric: true,
    sortable: true,
    cell: (r) => formatPercent(r.fallbackRate * 100),
  },
  { key: "p50Ms", header: "p50", numeric: true, sortable: true, cell: (r) => ms(r.p50Ms) },
  { key: "p95Ms", header: "p95", numeric: true, sortable: true, cell: (r) => ms(r.p95Ms) },
];

export function ReliabilityTable({ rows }: { rows: ReliabilityRow[] }) {
  return (
    <DataTable
      caption="Độ tin cậy theo dịch vụ"
      columns={RELIABILITY_COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      minWidth={520}
      defaultSort={{ key: "requests", direction: "desc" }}
      empty="Chưa có lượt gọi nào."
    />
  );
}
