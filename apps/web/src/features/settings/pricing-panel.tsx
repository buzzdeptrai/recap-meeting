"use client";

import { Card, CardHeader, DataTable, type DataColumn } from "@recap/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { formatIsoDate } from "@/lib/format";
import { PRICING_STATUS } from "@/lib/status";
import type { PricingRow } from "./settings-model";

const COLUMNS: DataColumn<PricingRow>[] = [
  {
    key: "vendor",
    header: "Nhà cung cấp",
    sortable: true,
    cell: (r) => (
      <span className="font-semibold">
        {r.vendor}
        <small className="block text-[11px] font-normal text-soft-muted">{r.service}</small>
      </span>
    ),
  },
  {
    key: "model",
    header: "Model",
    sortable: true,
    cell: (r) => <span className="font-soft-mono">{r.model}</span>,
  },
  {
    key: "price",
    header: "Đơn giá",
    cell: (r) => <span className="font-soft-mono">{r.price}</span>,
  },
  {
    key: "verified",
    header: "Xác minh",
    sortValue: (r) => Number(r.verified),
    cell: (r) => (
      <StatusBadge
        plain={!r.verified}
        status={PRICING_STATUS[r.verified ? "verified" : "example"]}
        title={r.notes ?? undefined}
      />
    ),
  },
  {
    key: "sourceUrl",
    header: "Nguồn",
    cell: (r) => (
      <a
        href={r.sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="soft-focus rounded text-soft-brand hover:underline"
      >
        {r.sourceHost}
      </a>
    ),
  },
  {
    key: "updatedAt",
    header: "Cập nhật",
    sortable: true,
    cell: (r) => <span className="font-soft-mono">{formatIsoDate(r.updatedAt)}</span>,
  },
];

export function PricingPanel({ rows }: { rows: PricingRow[] }) {
  return (
    <Card as="section" aria-labelledby="h-pricing">
      <CardHeader
        titleId="h-pricing"
        title="Bảng giá"
        description="Chỉ đọc, lấy từ config/pricing.json. Chi phí được tính lúc ghi nhận bằng bảng này; dòng “Ví dụ” chưa đối chiếu với trang giá chính thức."
      />
      <DataTable
        caption="Bảng giá nhà cung cấp"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        minWidth={820}
        empty="Chưa đọc được config/pricing.json nên chưa có đơn giá."
      />
    </Card>
  );
}
