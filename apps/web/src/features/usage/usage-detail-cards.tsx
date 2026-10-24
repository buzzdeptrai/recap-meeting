import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { ActionGroup, Button, Card, CardHeader } from "@recap/admin-ui";
import { BreakdownTable, ReliabilityTable } from "./breakdown-table";
import type { Sums } from "./usage-model";
import { EstimateNote, PricingBadge, TopMeetingsCard } from "./usage-sections";
import { exportHref, GROUP_LABELS, type UsageViewState } from "./usage-url";
import type { UsageViewModel } from "./usage-view-model";

interface Props {
  vm: UsageViewModel;
  state: UsageViewState;
  totals: Sums;
  now: number;
}

/** Breakdown table (with CSV export), top meetings and reliability. */
export function UsageDetailCards({ vm, state, totals, now }: Props) {
  const group = GROUP_LABELS[state.group].toLowerCase();
  return (
    <>
      <Card as="section" aria-labelledby="h-breakdown" className="col-span-12">
        <CardHeader
          titleId="h-breakdown"
          title={`Theo ${group}`}
          description="Chép lời tính theo kênh audio; mô hình ngôn ngữ tính theo token"
          action={
            <ActionGroup className="justify-end">
              <PricingBadge pricing={vm.pricing} />
              <Button asChild variant="outline" size="sm">
                <a href={exportHref(state, now)} download>
                  <DownloadSimple size={14} /> Xuất CSV
                </a>
              </Button>
            </ActionGroup>
          }
        />
        <BreakdownTable
          rows={vm.breakdown}
          totals={totals}
          estimated={vm.estimated}
          caption={`Chi phí theo ${group}`}
        />
        <EstimateNote pricing={vm.pricing} />
      </Card>
      <TopMeetingsCard meetings={vm.meetings} />
      <Card as="section" aria-labelledby="h-rel" className="col-span-7 max-[1100px]:col-span-12">
        <CardHeader
          titleId="h-rel"
          title="Độ tin cậy"
          description="Tỉ lệ lỗi, dự phòng và độ trễ"
        />
        <ReliabilityTable rows={vm.reliability} />
      </Card>
    </>
  );
}
