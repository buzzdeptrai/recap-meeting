import type { Metadata } from "next";
import { ChartBar } from "@phosphor-icons/react/dist/ssr";
import { Card, EmptyState, PageHeader } from "@recap/admin-ui";
import { UsageChartCard } from "@/features/usage/usage-chart-card";
import { UsageControls } from "@/features/usage/usage-controls";
import { loadUsagePage, nowMs } from "@/features/usage/usage-data";
import { UsageDetailCards } from "@/features/usage/usage-detail-cards";
import { BudgetCard } from "@/features/usage/usage-sections";
import { parseUsageState } from "@/features/usage/usage-url";
import { buildUsageViewModel } from "@/features/usage/usage-view-model";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mức sử dụng — Biên bản" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function UsagePage({ searchParams }: { searchParams: SearchParams }) {
  const state = parseUsageState(await searchParams);
  const now = nowMs();
  const data = loadUsagePage(state, now);
  const vm = buildUsageViewModel(data, state);
  return (
    <>
      <PageHeader
        breadcrumb={["Quản trị", "Mức sử dụng"]}
        title="Mức sử dụng"
        actions={<UsageControls state={state} />}
      />
      <div className="grid grid-cols-12 gap-6 max-[640px]:gap-4">
        {vm.empty ? (
          <Card
            as="section"
            aria-label="Chưa có dữ liệu"
            className="col-span-8 max-[1100px]:col-span-12"
          >
            <EmptyState
              icon={<ChartBar />}
              title="Chưa có dữ liệu sử dụng"
              description="Số liệu bắt đầu được ghi từ cuộc họp tiếp theo."
            />
          </Card>
        ) : (
          <UsageChartCard state={state} {...vm.chart} deltaLabel="so với kỳ trước" />
        )}
        <BudgetCard budget={vm.budget} estimated={vm.estimated} />
        {vm.empty ? null : (
          <UsageDetailCards vm={vm} state={state} totals={data.summary.totals} now={now} />
        )}
      </div>
    </>
  );
}
