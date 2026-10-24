import type { DeltaInfo } from "@recap/admin-ui";
import { SERVICE_HEALTH } from "@/lib/status";
import type { GroupKey, MetricKey } from "./usage-url";

/** Pure presentation helpers for usage figures (client- and server-safe). */
export interface Sums {
  audioSeconds: number;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  costUsd: number;
  errors: number;
  fallbacks: number;
}

export const VENDOR_LABEL: Record<string, string> = {
  deepgram: "Deepgram",
  gemini: "Gemini",
  openai: "OpenAI",
  assemblyai: "AssemblyAI",
};

export const SERVICE_LABEL: Record<string, string> = {
  stt_live: "Chép lời trực tiếp",
  stt_batch: "Chép lời từ file",
  translate: "Dịch",
  minutes: "Tạo biên bản",
};

const VENDOR_COLOR: Record<string, string> = {
  deepgram: "#7928CA",
  openai: "#FF0080",
  gemini: "#3A416F",
  assemblyai: "#17C1E8",
};
const PALETTE = ["#7928CA", "#FF0080", "#3A416F", "#17C1E8", "#A8B8D8"];

export function keyLabel(group: GroupKey | "meeting", key: string | null): string {
  if (key === null || key === "") return "Không gắn cuộc họp";
  if (group === "vendor") return VENDOR_LABEL[key] ?? key;
  if (group === "service") return SERVICE_LABEL[key] ?? key;
  return key;
}

export function keyColor(group: GroupKey, key: string, index: number): string {
  if (group === "vendor" && VENDOR_COLOR[key]) return VENDOR_COLOR[key];
  return PALETTE[index % PALETTE.length] ?? "#A8B8D8";
}

export const tokensOf = (s: Pick<Sums, "inputTokens" | "outputTokens">) =>
  s.inputTokens + s.outputTokens;

/** Delta chip from a percentage the API already computed (`null` = no baseline). */
export function deltaFromPct(pct: number | null | undefined): DeltaInfo | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  const rounded = Math.round(pct * 10) / 10;
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const text = `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
  return { text, direction };
}

export type ServiceStatus = "ok" | "warn" | "bad" | "idle";

export interface ServiceHealth {
  status: ServiceStatus;
  label: string;
}

const WARN_RATE = 0.02;
const BAD_RATE = 0.05;

/**
 * Status dot for a vendor/model: green below 2% errors, amber 2-5%, red above 5%;
 * no requests at all is "Chưa có dữ liệu" (grey), never green.
 */
export function serviceHealth(requests: number, errorRate: number): ServiceHealth {
  if (requests <= 0 || !Number.isFinite(errorRate))
    return { status: "idle", label: SERVICE_HEALTH.idle.label };
  if (errorRate > BAD_RATE) return { status: "bad", label: SERVICE_HEALTH.bad.label };
  if (errorRate >= WARN_RATE) return { status: "warn", label: SERVICE_HEALTH.warn.label };
  return { status: "ok", label: SERVICE_HEALTH.ok.label };
}

export const metricOf = (metric: MetricKey, s: Sums): number =>
  metric === "cost"
    ? s.costUsd
    : metric === "seconds"
      ? s.audioSeconds
      : metric === "tokens"
        ? tokensOf(s)
        : s.requests;

export interface BudgetInput {
  monthlyUsd: number;
  month: string;
  spentUsd: number;
  projectedUsd: number;
  percentUsed: number;
  daysElapsed: number;
  daysInMonth: number;
}

export interface BudgetView {
  limitUsd: number;
  spentUsd: number;
  remainingUsd: number;
  percentUsed: number;
  projectedUsd: number;
  projectedPercent: number;
  avgPerDayUsd: number;
  daysLeft: number;
  alertUsd: number;
  monthLabel: string;
  overAlert: boolean;
}

export const ALERT_THRESHOLD = 0.8;

export function budgetView(b: BudgetInput): BudgetView {
  const percentOf = (usd: number) => (b.monthlyUsd > 0 ? (usd / b.monthlyUsd) * 100 : 0);
  const [year, month] = b.month.split("-");
  return {
    limitUsd: b.monthlyUsd,
    spentUsd: b.spentUsd,
    remainingUsd: Math.max(0, b.monthlyUsd - b.spentUsd),
    percentUsed: b.percentUsed,
    projectedUsd: b.projectedUsd,
    projectedPercent: percentOf(b.projectedUsd),
    avgPerDayUsd: b.spentUsd / Math.max(1, b.daysElapsed),
    daysLeft: Math.max(0, b.daysInMonth - Math.ceil(b.daysElapsed)),
    alertUsd: b.monthlyUsd * ALERT_THRESHOLD,
    monthLabel: `tháng ${Number(month)}${year ? `/${year}` : ""}`,
    overAlert: b.spentUsd >= b.monthlyUsd * ALERT_THRESHOLD,
  };
}
