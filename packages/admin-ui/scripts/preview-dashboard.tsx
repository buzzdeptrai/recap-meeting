import {
  CalendarBlank,
  CurrencyCircleDollar,
  Hash,
  Question,
  Sparkle,
  Stack,
  Warning,
  Waveform,
} from "@phosphor-icons/react/dist/ssr";
import {
  Badge,
  Card,
  CardHeader,
  CardLink,
  ChartLegend,
  formatDelta,
  formatNumber,
  formatUsd,
  formatUsdAxis,
  GradientText,
  LineAreaChart,
  MiniStat,
  NavyBarCard,
  PageHeader,
  StatCard,
  StatusDot,
} from "../src";
import { COST, DAYS, HOURS, MEETINGS, RECENT, SERVICES } from "./preview-data";
import { ChevronRightIcon } from "../src/components/icons";

export interface Widths {
  line: number;
  bar: number;
}

const GRID = "grid grid-cols-12 gap-6 max-[640px]:gap-4";
const C3 = "col-span-3 max-[1100px]:col-span-6 max-[640px]:col-span-12";

export function DashboardPage({ widths }: { widths: Widths }) {
  return (
    <>
      <PageHeader
        breadcrumb={["Quản trị", "Tổng quan"]}
        title={
          <>
            Tổng quan <GradientText>tháng 10</GradientText>
          </>
        }
        actions={
          <CardLink href="usage.html">
            Xem mức sử dụng <ChevronRightIcon />
          </CardLink>
        }
      />
      <div className={GRID}>
        <StatCard
          className={C3}
          label="Cuộc họp"
          value="38"
          delta={formatDelta(38, 32)}
          deltaLabel="so với T9"
          icon={<CalendarBlank weight="regular" />}
          tone="main"
        />
        <StatCard
          className={C3}
          label="Giờ chép lời"
          value="79,2"
          delta={formatDelta(79.2, 69.8)}
          deltaLabel="so với T9"
          icon={<Waveform />}
          tone="blue"
        />
        <StatCard
          className={C3}
          label="Token LLM"
          value="6,59"
          unit="triệu"
          delta={formatDelta(6.59, 5.52)}
          deltaLabel="so với T9"
          icon={<Hash />}
          tone="green"
        />
        <StatCard
          className={C3}
          label="Chi phí (ví dụ)"
          value="$41,87"
          deltaLabel="70% của $60"
          icon={<CurrencyCircleDollar />}
          tone="orange"
          progress={{ value: 70, label: "70% ngân sách" }}
        />

        <Card as="section" aria-labelledby="h-line" className="col-span-7 max-[1100px]:col-span-12">
          <CardHeader
            titleId="h-line"
            title="Cuộc họp & chi phí theo ngày"
            description="1 – 22 tháng 10, 2026"
            action={
              <ChartLegend
                items={[
                  { label: "Chi phí ($, ví dụ)", color: "#FF0080" },
                  { label: "Cuộc họp", color: "#3A416F" },
                ]}
              />
            }
          />
          <LineAreaChart
            ariaLabel="Biểu đồ đường: số cuộc họp và chi phí ước tính mỗi ngày, 1 đến 22 tháng 10"
            labels={DAYS}
            initialWidth={widths.line}
            height={440}
            axis={{ right: { format: formatUsdAxis } }}
            series={[
              {
                id: "cost",
                label: "Chi phí (ví dụ)",
                values: COST,
                color: "#FF0080",
                axis: "right",
                formatValue: formatUsd,
              },
              {
                id: "meet",
                label: "Cuộc họp",
                values: MEETINGS,
                color: "#3A416F",
                areaOpacity: 0.12,
                formatValue: (v) => formatNumber(v),
              },
            ]}
          />
        </Card>

        <Card as="section" aria-labelledby="h-bar" className="col-span-5 max-[1100px]:col-span-12">
          <NavyBarCard
            title="Giờ chép lời theo ngày"
            subtitle="Tổng 79,2 giờ trong tháng"
            ariaLabel="Biểu đồ cột: giờ chép lời mỗi ngày, tổng 79,2 giờ"
            labels={DAYS}
            values={HOURS}
            seriesLabel="Giờ chép lời"
            formatValue={(v) => `${formatNumber(v, 1)} giờ`}
            initialWidth={widths.bar}
          />
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 max-[640px]:grid-cols-1">
            <MiniStat
              label="Deepgram"
              value="$36,59"
              icon={<Waveform />}
              tone="main"
              progress={{ value: 88, label: "88%" }}
            />
            <MiniStat
              label="Gemini"
              value="$0,63"
              icon={<Sparkle />}
              tone="blue"
              progress={{ value: 4, label: "4%" }}
            />
            <MiniStat
              label="OpenAI"
              value="$4,65"
              icon={<Stack />}
              tone="green"
              progress={{ value: 11, label: "11%" }}
            />
            <MiniStat
              label="Lượt lỗi"
              value="12"
              icon={<Warning />}
              tone="red"
              progress={{ value: 2, label: "2%" }}
            />
          </div>
        </Card>

        <Card as="section" aria-labelledby="h-rec" className="col-span-7 max-[1100px]:col-span-12">
          <CardHeader
            titleId="h-rec"
            title="Cuộc họp gần đây"
            description="5 cuộc họp mới nhất"
            action={
              <CardLink href="#">
                Xem tất cả <ChevronRightIcon />
              </CardLink>
            }
          />
          <ul>
            <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 pb-2 text-[11px] font-bold tracking-[0.06em] text-soft-muted uppercase max-[640px]:grid-cols-[minmax(0,1fr)_auto]">
              <span>Cuộc họp</span>
              <span className="max-[640px]:hidden">Ngôn ngữ</span>
              <span>Trạng thái</span>
            </li>
            {RECENT.map((m) => (
              <li
                key={m.title}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-t border-soft-line py-3 max-[640px]:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <span className="block truncate font-semibold">{m.title}</span>
                  <span className="font-soft-mono text-xs text-soft-muted">{m.meta}</span>
                </div>
                <span className="inline-flex gap-1 max-[640px]:hidden">
                  {m.langs.map((l) => (
                    <Badge key={l} shape="chip" variant={l === "VI" ? "accent" : "cyan"}>
                      {l}
                    </Badge>
                  ))}
                </span>
                <Badge variant={m.status}>{m.statusLabel}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card as="section" aria-labelledby="h-svc" className="col-span-5 max-[1100px]:col-span-12">
          <CardHeader
            titleId="h-svc"
            title="Tình trạng dịch vụ"
            description="Cập nhật 22/10 10:30"
          />
          {SERVICES.map((s, i) => (
            <div
              key={s.name}
              className={`flex items-center gap-4 py-3 ${i ? "border-t border-soft-line" : ""}`}
            >
              <StatusDot status="ok" label="Hoạt động" />
              <div className="min-w-0 flex-1">
                <b className="block">{s.name}</b>
                <small className="text-xs text-soft-muted">{s.desc}</small>
              </div>
              <div className="text-right text-xs leading-snug text-soft-muted">
                p95 <b className="soft-tabular text-[13px] text-soft-ink">{s.p95}</b>
                <br />
                Lỗi <b className="soft-tabular text-[13px] text-soft-ink">{s.err}</b>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

export const HelpIcon = Question;
