import { Card, CardHeader, CardLink, formatUsd } from "@recap/admin-ui";
import type { BudgetSetting } from "./settings-model";

export function BudgetPanel({ budget }: { budget: BudgetSetting }) {
  return (
    <Card as="section" aria-labelledby="h-budget-set" className="max-w-xl">
      <CardHeader
        titleId="h-budget-set"
        title="Ngân sách tháng"
        description="Mức chi tiêu API tối đa mỗi tháng, dùng để vẽ thanh ngân sách và cảnh báo."
        action={<CardLink href="/usage">Xem mức sử dụng ›</CardLink>}
      />
      <div className="soft-tabular text-[32px] leading-tight font-bold tracking-[-0.02em]">
        {formatUsd(budget.monthlyUsd)}
        <small className="ml-2 text-[13px] font-semibold text-soft-muted">/ tháng</small>
      </div>
      <p className="mt-1 text-[13px] text-soft-muted">
        Cảnh báo ở 80%: {formatUsd(budget.alertUsd)}
        {budget.fromEnv ? "" : " · đang dùng giá trị mặc định"}
      </p>
      <p className="mt-4 rounded-xl bg-soft-bg px-4 py-3 text-xs text-soft-muted">
        Giá trị này lấy từ biến{" "}
        <code className="font-soft-mono font-bold">USAGE_MONTHLY_BUDGET_USD</code> trong tệp{" "}
        <code className="font-soft-mono font-bold">.env</code>. Muốn đổi, sửa tệp rồi khởi động lại
        máy chủ; trang web không sửa được .env.
      </p>
    </Card>
  );
}
