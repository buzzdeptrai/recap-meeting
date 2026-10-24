import { CurrencyCircleDollar } from "@phosphor-icons/react/dist/ssr";
import {
  Card,
  CardHeader,
  DataTable,
  formatDelta,
  formatDuration,
  formatNumber,
  formatPercent,
  formatUsd,
  formatUsdAxis,
  PageHeader,
  Pill,
  ProgressBar,
  SegmentedControl,
  Select,
  StackedBarChart,
  type DataColumn,
  IconTile,
} from "../src";
import { InfoIcon } from "../src/components/icons";
import { DG, GE, OP, DAYS, VENDORS, type VendorRow } from "./preview-data";

const total = VENDORS.reduce((s, v) => s + v.cost, 0);
const dash = <span className="text-[#a0a8b8]">–</span>;

const COLUMNS: DataColumn<VendorRow>[] = [
  {
    key: "name",
    header: "Nhà cung cấp",
    sortable: true,
    cell: (r) => (
      <span className="flex items-center gap-3 font-semibold">
        <i className="size-3 rounded-full" style={{ background: r.color }} />
        <span>
          {r.name}
          <small className="block text-[11px] font-normal text-soft-muted">{r.models}</small>
        </span>
      </span>
    ),
  },
  {
    key: "seconds",
    header: "Chép lời (giờ kênh)",
    numeric: true,
    sortable: true,
    cell: (r) =>
      r.seconds ? (
        <>
          {formatDuration(r.seconds)}
          <small className="block font-soft text-[11px] font-normal text-soft-muted">
            {formatNumber(r.seconds / 60)} phút kênh
          </small>
        </>
      ) : (
        dash
      ),
  },
  {
    key: "tokensIn",
    header: "Token vào",
    numeric: true,
    sortable: true,
    cell: (r) => (r.tokensIn ? formatNumber(r.tokensIn) : dash),
  },
  {
    key: "tokensOut",
    header: "Token ra",
    numeric: true,
    sortable: true,
    cell: (r) => (r.tokensOut ? formatNumber(r.tokensOut) : dash),
  },
  {
    key: "calls",
    header: "Lượt gọi",
    numeric: true,
    sortable: true,
    cell: (r) => formatNumber(r.calls),
  },
  {
    key: "cost",
    header: "Chi phí (ví dụ)",
    numeric: true,
    sortable: true,
    highlight: true,
    cell: (r) => formatUsd(r.cost),
  },
  {
    key: "share",
    header: "Tỉ trọng",
    numeric: true,
    sortValue: (r) => r.cost,
    cell: (r) => (
      <span className="inline-flex items-center gap-2">
        <ProgressBar
          className="w-24"
          color={r.color}
          value={(r.cost / total) * 100}
          label={`${r.name} ${formatPercent((r.cost / total) * 100, { decimals: 0 })}`}
        />
        <span className="w-9 text-right">
          {formatPercent((r.cost / total) * 100, { decimals: 0 })}
        </span>
      </span>
    ),
  },
];

export function UsagePage({ chartWidth }: { chartWidth: number }) {
  return (
    <>
      <PageHeader
        breadcrumb={["Quản trị", "Mức sử dụng"]}
        title="Mức sử dụng"
        actions={
          <>
            <SegmentedControl
              ariaLabel="Khoảng thời gian"
              value="month"
              onValueChange={() => {}}
              options={[
                { value: "7", label: "7 ngày" },
                { value: "30", label: "30 ngày" },
                { value: "month", label: "Tháng này" },
              ]}
            />
            <Select
              ariaLabel="Nhóm theo"
              prefix="Nhóm theo:"
              value="vendor"
              onValueChange={() => {}}
              options={[
                { value: "vendor", label: "Nhà cung cấp" },
                { value: "model", label: "Model" },
              ]}
            />
          </>
        }
      />
      <div className="grid grid-cols-12 gap-6 max-[640px]:gap-4">
        <Card
          as="section"
          aria-labelledby="head-label"
          className="col-span-8 max-[1100px]:col-span-12"
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p id="head-label" className="text-[13px] font-semibold text-soft-muted">
                Chi phí (ví dụ) · 01/10 – 22/10/2026
              </p>
              <div className="soft-tabular text-[32px] leading-tight font-bold tracking-[-0.02em] max-[640px]:text-[28px]">
                {formatUsd(total)}
              </div>
              <p className="mt-1 text-[13px] text-soft-muted">
                <b className="text-soft-ok">{formatDelta(41.87, 36.12)?.text}</b> so với kỳ trước
              </p>
            </div>
            <SegmentedControl
              variant="tabs"
              ariaLabel="Chỉ số"
              value="cost"
              onValueChange={() => {}}
              options={[
                { value: "cost", label: "Chi phí" },
                { value: "sec", label: "Giây chép lời" },
                { value: "tok", label: "Token" },
                { value: "calls", label: "Lượt gọi" },
              ]}
            />
          </div>
          <StackedBarChart
            variant="area"
            ariaLabel="Biểu đồ chi phí theo ngày, nhóm theo nhà cung cấp"
            labels={DAYS}
            initialWidth={chartWidth}
            formatValue={formatUsd}
            formatAxis={formatUsdAxis}
            series={[
              { id: "dg", label: "Deepgram", values: DG, color: "#1D4ED8" },
              { id: "oa", label: "OpenAI", values: OP, color: "#FF0080" },
              { id: "ge", label: "Gemini", values: GE, color: "#3A416F" },
            ]}
          />
        </Card>

        <Card
          as="section"
          aria-labelledby="h-bud"
          className="col-span-4 self-start max-[1100px]:col-span-12"
        >
          <CardHeader
            titleId="h-bud"
            title="Ngân sách tháng 10"
            description="Đơn giá ví dụ"
            action={
              <IconTile tone="main">
                <CurrencyCircleDollar />
              </IconTile>
            }
            className="mb-0"
          />
          <div className="soft-tabular mt-2 mb-1 text-[32px] leading-tight font-bold tracking-[-0.02em]">
            $41,87 <small className="text-[13px] font-semibold text-soft-muted">/ $60,00</small>
          </div>
          <ProgressBar
            className="mt-4 mb-2"
            size="lg"
            value={70}
            marker={98}
            markerLabel="Dự kiến cuối tháng"
            label="Đã dùng 70% ngân sách; dự kiến cuối tháng 98%"
          />
          <div className="flex justify-between text-[13px] text-soft-muted">
            <span>Đã dùng 70%</span>
            <span>Còn $18,13</span>
          </div>
          <dl className="mt-4">
            {[
              ["Dự kiến cuối tháng", "≈ $59"],
              ["Trung bình mỗi ngày", "$1,90"],
              ["Ngày còn lại", "9"],
              ["Ngưỡng cảnh báo (80%)", "$48,00"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between gap-4 border-t border-soft-line py-3 text-[13px]"
              >
                <dt className="text-soft-muted">{k}</dt>
                <dd className="soft-tabular font-soft-mono font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card as="section" aria-labelledby="tbl-title" className="col-span-12">
          <CardHeader
            titleId="tbl-title"
            title="Theo nhà cung cấp"
            description="Chép lời tính theo kênh audio; mô hình ngôn ngữ tính theo token"
            action={<Pill>ví dụ</Pill>}
          />
          <DataTable
            caption="Chi phí theo nhà cung cấp"
            columns={COLUMNS}
            rows={VENDORS}
            rowKey={(r) => r.id}
            minWidth={760}
            defaultSort={{ key: "cost", direction: "desc" }}
            footer={{
              name: "Tổng",
              seconds: formatDuration(285120),
              tokensIn: formatNumber(5670000),
              tokensOut: formatNumber(920000),
              calls: formatNumber(5494),
              cost: formatUsd(total),
            }}
          />
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-soft-bg px-4 py-3 text-xs text-soft-muted">
            <InfoIcon className="mt-px shrink-0" />
            Ước tính từ đơn giá ví dụ, đối chiếu trang thanh toán của nhà cung cấp.
          </p>
        </Card>
      </div>
    </>
  );
}
