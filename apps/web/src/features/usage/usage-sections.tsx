import Link from "next/link";
import { CurrencyCircleDollar, Info } from "@phosphor-icons/react/dist/ssr";
import {
  Card,
  CardHeader,
  formatDuration,
  formatNumber,
  formatUsd,
  IconTile,
  ProgressBar,
} from "@recap/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { formatIsoDate } from "@/lib/format";
import { PRICING_STATUS } from "@/lib/status";
import { ALERT_THRESHOLD, type BudgetView } from "./usage-model";
import type { MeetingCostRow, UsageViewModel } from "./usage-view-model";

function BudgetFacts({ budget }: { budget: BudgetView }) {
  const rows: Array<[string, string]> = [
    ["Dự kiến cuối tháng", `≈ ${formatUsd(budget.projectedUsd)}`],
    ["Trung bình mỗi ngày", formatUsd(budget.avgPerDayUsd)],
    ["Ngày còn lại", formatNumber(budget.daysLeft)],
    [`Ngưỡng cảnh báo (${ALERT_THRESHOLD * 100}%)`, formatUsd(budget.alertUsd)],
  ];
  return (
    <dl className="mt-4">
      {rows.map(([k, v]) => (
        <div
          key={k}
          className="flex justify-between gap-4 border-t border-soft-line py-3 text-[13px]"
        >
          <dt className="text-soft-muted">{k}</dt>
          <dd className="soft-tabular font-soft-mono font-bold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BudgetCard({ budget, estimated }: { budget: BudgetView; estimated: boolean }) {
  const used = Math.round(budget.percentUsed);
  return (
    <Card
      as="section"
      aria-labelledby="h-budget"
      className="col-span-4 self-start max-[1100px]:col-span-12"
    >
      <CardHeader
        titleId="h-budget"
        title={`Ngân sách ${budget.monthLabel}`}
        description={estimated ? "Đơn giá ví dụ" : "Ước tính theo bảng giá"}
        action={
          <IconTile tone="main">
            <CurrencyCircleDollar />
          </IconTile>
        }
        className="mb-0"
      />
      <div className="soft-tabular mt-2 mb-1 text-[32px] leading-tight font-bold tracking-[-0.02em]">
        {formatUsd(budget.spentUsd)}{" "}
        <small className="text-[13px] font-semibold text-soft-muted">
          / {formatUsd(budget.limitUsd)}
        </small>
      </div>
      <ProgressBar
        className="mt-4 mb-2"
        size="lg"
        value={budget.percentUsed}
        marker={Math.min(100, budget.projectedPercent)}
        markerLabel="Dự kiến cuối tháng"
        label={`Đã dùng ${used}% ngân sách; dự kiến cuối tháng ${Math.round(budget.projectedPercent)}%`}
      />
      <div className="flex justify-between text-[13px] text-soft-muted">
        <span>Đã dùng {used}%</span>
        <span>Còn {formatUsd(budget.remainingUsd)}</span>
      </div>
      {budget.overAlert ? (
        <p className="mt-3 rounded-xl bg-[#fff3d6] px-3 py-2 text-xs font-semibold text-[#8a5b00]">
          Đã vượt ngưỡng cảnh báo {ALERT_THRESHOLD * 100}% ngân sách tháng.
        </p>
      ) : null}
      <BudgetFacts budget={budget} />
    </Card>
  );
}

export function TopMeetingsCard({ meetings }: { meetings: MeetingCostRow[] }) {
  return (
    <Card as="section" aria-labelledby="h-top" className="col-span-5 max-[1100px]:col-span-12">
      <CardHeader titleId="h-top" title="Cuộc họp tốn nhất" description="Theo chi phí ước tính" />
      {meetings.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-soft-muted">
          Chưa có cuộc họp nào phát sinh chi phí trong khoảng này.
        </p>
      ) : (
        <ol>
          {meetings.map((m, i) => (
            <li key={m.id} className={i ? "border-t border-soft-line" : ""}>
              <Link
                href={`/meetings/${m.id}`}
                className="soft-focus -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-soft-bg"
              >
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{m.title}</b>
                  <small className="text-xs text-soft-muted">
                    {m.audioSeconds > 0 ? `${formatDuration(m.audioSeconds)} kênh · ` : ""}
                    {formatNumber(m.requests)} lượt gọi
                  </small>
                </span>
                <span className="soft-tabular font-soft-mono font-bold">
                  {formatUsd(m.costUsd)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function PricingBadge({ pricing }: { pricing: UsageViewModel["pricing"] }) {
  if (pricing.allVerified) {
    return (
      <StatusBadge status={PRICING_STATUS.verified}>
        Đơn giá đã xác minh{pricing.updatedAt ? ` · ${formatIsoDate(pricing.updatedAt)}` : ""}
      </StatusBadge>
    );
  }
  return (
    <StatusBadge plain status={PRICING_STATUS.example} title={pricing.unverified.join(", ")}>
      Đơn giá ví dụ
    </StatusBadge>
  );
}

export function EstimateNote({ pricing }: { pricing: UsageViewModel["pricing"] }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-xl bg-soft-bg px-4 py-3 text-xs text-soft-muted">
      <Info size={16} className="mt-px shrink-0" />
      {pricing.allVerified
        ? "Chi phí là ước tính từ bảng giá trong cài đặt (đã đối chiếu trang giá chính thức), không phải hóa đơn. Đối chiếu với trang thanh toán của nhà cung cấp."
        : "Chi phí là ước tính từ đơn giá ví dụ, chưa phải hóa đơn. Đối chiếu với trang thanh toán của nhà cung cấp."}{" "}
      Lượt gọi chưa có đơn giá được tính 0 đồng.
    </p>
  );
}
