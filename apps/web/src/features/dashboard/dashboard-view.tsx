import Link from "next/link";
import { CalendarBlank, Clock, FileText, Flag, Plus } from "@phosphor-icons/react/dist/ssr";
import {
  buttonVariants,
  Card,
  CardHeader,
  ChartLegend,
  EmptyState,
  formatMs,
  formatNumber,
  formatPercent,
  GradientText,
  PageHeader,
  StatCard,
  StatusDot,
} from "@recap/admin-ui";
import { DashboardAttention } from "./dashboard-attention";
import { MeetingsChart } from "./dashboard-charts";
import type { DashboardModel } from "./dashboard-model";
import { DashboardRecent } from "./dashboard-recent";

const GRID = "grid grid-cols-12 gap-6 max-[640px]:gap-4";
const C3 = "col-span-3 max-[1100px]:col-span-6 max-[640px]:col-span-12";
const WIDE = "col-span-7 max-[1100px]:col-span-12";
const NARROW = "col-span-5 max-[1100px]:col-span-12";

const VS = "so với kỳ trước";
const IN_MONTH = "trong tháng này";
const NEED_LINK =
  "soft-focus block rounded-soft transition-shadow duration-150 hover:shadow-soft [&>*]:h-full";

function StatCards({ m }: { m: DashboardModel }) {
  return (
    <>
      <StatCard
        className={C3}
        label="Cuộc họp"
        value={formatNumber(m.meetings.value)}
        delta={m.meetings.delta}
        deltaLabel={m.meetings.delta ? VS : IN_MONTH}
        icon={<CalendarBlank />}
        tone="main"
      />
      <StatCard
        className={C3}
        label="Giờ họp"
        value={m.hours.value}
        unit={m.hours.unit}
        delta={m.hours.delta}
        deltaLabel={m.hours.delta ? VS : IN_MONTH}
        icon={<Clock />}
        tone="blue"
      />
      <Link
        href="/meetings?minutes=need"
        className={`${C3} ${NEED_LINK}`}
        aria-label={`Biên bản chờ tạo hoặc duyệt: ${m.needMinutes}. Xem danh sách`}
      >
        <StatCard
          label="Biên bản chờ"
          value={formatNumber(m.needMinutes)}
          deltaLabel={
            m.needMinutes > 0 ? "Chờ tạo/duyệt · bấm để xem" : "Không có biên bản tồn đọng"
          }
          icon={<FileText />}
          tone="orange"
        />
      </Link>
      <StatCard
        className={C3}
        label="Kết luận đã đánh dấu"
        value={formatNumber(m.conclusions)}
        deltaLabel={IN_MONTH}
        icon={<Flag />}
        tone="green"
      />
    </>
  );
}

function MeetingsChartCard({ m }: { m: DashboardModel }) {
  return (
    <Card as="section" aria-labelledby="h-line" className={WIDE}>
      <CardHeader
        titleId="h-line"
        title="Cuộc họp theo ngày"
        description={`Trong ${m.monthText}`}
        action={
          m.quiet ? undefined : (
            <ChartLegend
              items={[
                { label: "Cuộc họp", color: "#3A416F" },
                { label: "Giờ họp", color: "#FF0080" },
              ]}
            />
          )
        }
      />
      {m.quiet ? (
        <EmptyState
          icon={<CalendarBlank />}
          title={`Chưa có cuộc họp trong ${m.monthText}`}
          description="Biểu đồ sẽ hiện khi bạn bắt đầu cuộc họp đầu tiên của tháng."
          action={
            <Link href="/meetings/new" className={buttonVariants({ variant: "outline" })}>
              <Plus size={16} />
              Tạo cuộc họp mới
            </Link>
          }
        />
      ) : (
        <MeetingsChart
          labels={m.chart.labels}
          meetings={m.chart.meetings}
          hours={m.chart.hours}
          rangeText={m.monthText}
        />
      )}
    </Card>
  );
}

function ServiceStatus({ m }: { m: DashboardModel }) {
  return (
    <Card as="section" aria-labelledby="h-svc" className={NARROW}>
      <CardHeader
        titleId="h-svc"
        title="Tình trạng dịch vụ"
        description={`Tổng hợp ${m.monthText}`}
      />
      {m.services.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-soft-muted">Chưa có dữ liệu</p>
      ) : (
        m.services.map((s, i) => (
          <div
            key={s.id}
            className={`flex items-center gap-4 py-3 ${i ? "border-t border-soft-line" : ""}`}
          >
            <StatusDot status={s.health.status} label={s.health.label} />
            <div className="min-w-0 flex-1">
              <b className="block">{s.name}</b>
              <small className="text-xs text-soft-muted">
                {s.model} · {s.health.label}
              </small>
            </div>
            <div className="text-right text-xs leading-snug text-soft-muted">
              p95{" "}
              <b className="soft-tabular text-[13px] text-soft-ink">
                {s.p95Ms === null ? "–" : formatMs(s.p95Ms)}
              </b>
              <br />
              Lỗi{" "}
              <b className="soft-tabular text-[13px] text-soft-ink">
                {formatPercent(s.errorRate * 100)}
              </b>
            </div>
          </div>
        ))
      )}
    </Card>
  );
}

export function DashboardView({ model: m }: { model: DashboardModel }) {
  return (
    <>
      <PageHeader
        breadcrumb={["Quản trị", "Tổng quan"]}
        title={
          <>
            Tổng quan <GradientText>{m.monthText}</GradientText>
          </>
        }
        actions={
          <Link href="/meetings/new" className={buttonVariants()}>
            <Plus size={16} />
            Cuộc họp mới
          </Link>
        }
      />
      <div className={GRID}>
        <StatCards m={m} />
        <MeetingsChartCard m={m} />
        <DashboardRecent rows={m.recent} className={NARROW} />
        <DashboardAttention attention={m.attention} className={WIDE} />
        <ServiceStatus m={m} />
      </div>
    </>
  );
}
