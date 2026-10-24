import type { DeltaInfo } from "@recap/admin-ui";
import type { MeetingStatus } from "@recap/db";
import type { MeetingListItemDto } from "@/lib/api-types";
import { dayLabel } from "@/features/usage/usage-format";
import {
  deltaFromPct,
  serviceHealth,
  VENDOR_LABEL,
  type ServiceHealth,
} from "@/features/usage/usage-model";
import { localDate } from "@/features/usage/usage-url";
import type { DashboardInputs, DashboardMeeting } from "./dashboard-data";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const STALE_DRAFT_DAYS = 7;
export const ATTENTION_SHOWN = 5;

export interface MeetingCounts {
  perDay: number[];
  /** Recorded duration per day, in ms. */
  perDayMs: number[];
  current: number;
  previous: number;
  currentMs: number;
  previousMs: number;
}

/** Meetings (and their recorded time) per local day, plus totals for this vs the previous equal-length period. */
export function countMeetings(
  meetings: DashboardMeeting[],
  range: { from: string; to: string; tzOffsetMinutes: number },
  days: string[],
): MeetingCounts {
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);
  const prevFrom = from - (to - from);
  const index = new Map(days.map((d, i) => [d, i]));
  const out: MeetingCounts = {
    perDay: days.map(() => 0),
    perDayMs: days.map(() => 0),
    current: 0,
    previous: 0,
    currentMs: 0,
    previousMs: 0,
  };
  for (const m of meetings) {
    const at = Date.parse(m.startedAt ?? m.createdAt);
    const ms = m.durationMs ?? 0;
    if (at >= from && at < to) {
      out.current += 1;
      out.currentMs += ms;
      const i = index.get(localDate(at, range.tzOffsetMinutes));
      if (i !== undefined) {
        out.perDay[i] = (out.perDay[i] ?? 0) + 1;
        out.perDayMs[i] = (out.perDayMs[i] ?? 0) + ms;
      }
    } else if (at >= prevFrom && at < from) {
      out.previous += 1;
      out.previousMs += ms;
    }
  }
  return out;
}

const pctChange = (now: number, before: number): number | null =>
  before > 0 ? ((now - before) / before) * 100 : null;

export interface StatModel {
  value: string;
  unit?: string;
  delta: DeltaInfo | null;
}

/** Recorded time as "4,5 giờ" or, under an hour, "35 phút". */
export function hoursStat(ms: number, previousMs: number): StatModel {
  const delta = deltaFromPct(pctChange(ms, previousMs));
  if (ms > 0 && ms < MS_PER_HOUR) {
    return { value: String(Math.max(1, Math.round(ms / 60_000))), unit: "phút", delta };
  }
  const hours = ms / MS_PER_HOUR;
  return {
    value: hours.toLocaleString("vi-VN", { maximumFractionDigits: 1 }),
    unit: "giờ",
    delta,
  };
}

export type AttentionKind = "no-minutes" | "stale" | "old-draft" | "empty";

export interface AttentionItem {
  id: string;
  title: string;
  kind: AttentionKind;
  reason: string;
  when: string;
  href: string;
  actionLabel: string;
}

const ATTENTION_ORDER: AttentionKind[] = ["no-minutes", "stale", "old-draft", "empty"];

function attentionFor(m: MeetingListItemDto, nowMs: number): AttentionItem | null {
  const base = { id: m.id, title: m.title, when: m.startedAt ?? m.createdAt };
  const room = `/meetings/${m.id}`;
  const minutes = `${room}/minutes`;
  if (m.status === "draft") {
    const age = nowMs - Date.parse(m.createdAt);
    if (age < STALE_DRAFT_DAYS * MS_PER_DAY) return null;
    const days = Math.floor(age / MS_PER_DAY);
    return {
      ...base,
      kind: "old-draft",
      reason: `Nháp đã ${days} ngày chưa bắt đầu`,
      href: room,
      actionLabel: "Mở",
    };
  }
  if (m.status !== "ended") return null;
  if (m.wordCount === 0) {
    return {
      ...base,
      kind: "empty",
      reason: "Kết thúc nhưng chưa có lời thoại",
      href: room,
      actionLabel: "Xem",
    };
  }
  const entries = Object.values(m.minutes);
  if (entries.length === 0) {
    return {
      ...base,
      kind: "no-minutes",
      reason: "Chưa có biên bản",
      href: minutes,
      actionLabel: "Tạo biên bản",
    };
  }
  if (entries.some((e) => e.stale)) {
    return {
      ...base,
      kind: "stale",
      reason: "Biên bản cũ hơn lời thoại",
      href: minutes,
      actionLabel: "Cập nhật",
    };
  }
  return null;
}

export interface AttentionModel {
  total: number;
  items: AttentionItem[];
}

/** Meetings that need a person, most urgent kind first, newest first within a kind. */
export function buildAttention(
  ended: MeetingListItemDto[],
  drafts: MeetingListItemDto[],
  nowMs: number,
): AttentionModel {
  const all = [...ended, ...drafts]
    .map((m) => attentionFor(m, nowMs))
    .filter((item): item is AttentionItem => item !== null);
  const rank = (item: AttentionItem) => ATTENTION_ORDER.indexOf(item.kind);
  const sorted = all.sort((a, b) => rank(a) - rank(b) || Date.parse(b.when) - Date.parse(a.when));
  return { total: sorted.length, items: sorted.slice(0, ATTENTION_SHOWN) };
}

export interface ServiceRow {
  id: string;
  name: string;
  model: string;
  p95Ms: number | null;
  errorRate: number;
  health: ServiceHealth;
}

export interface RecentRow {
  id: string;
  title: string;
  href: string;
  when: string;
  durationMs: number | null;
  /** Languages the minutes exist in (same meaning as the chips on the meeting list). */
  minutesLangs: Array<"VI" | "EN">;
  status: MeetingStatus;
}

export interface DashboardModel {
  /** No meetings this month: the chart shows an empty state instead of a flat line. */
  quiet: boolean;
  monthText: string;
  meetings: { value: number; delta: DeltaInfo | null };
  hours: StatModel;
  needMinutes: number;
  conclusions: number;
  chart: { labels: string[]; meetings: number[]; hours: number[] };
  attention: AttentionModel;
  services: ServiceRow[];
  recent: RecentRow[];
}

export function toRecentRow(m: MeetingListItemDto): RecentRow {
  const hasMinutes = m.minutesLangs.length > 0;
  return {
    id: m.id,
    title: m.title,
    href: m.status === "ended" && hasMinutes ? `/meetings/${m.id}/minutes` : `/meetings/${m.id}`,
    when: m.startedAt ?? m.createdAt,
    durationMs: m.durationMs,
    minutesLangs: m.minutesLangs.map((lang) => (lang === "vi" ? "VI" : "EN")),
    status: m.status,
  };
}

export function buildDashboardModel(input: DashboardInputs): DashboardModel {
  const counts = countMeetings(input.meetings, input.range, input.days);
  const month = Number((input.days[0] ?? "0000-01").slice(5, 7));
  return {
    quiet: counts.current === 0,
    monthText: `tháng ${month}`,
    meetings: {
      value: counts.current,
      delta: deltaFromPct(pctChange(counts.current, counts.previous)),
    },
    hours: hoursStat(counts.currentMs, counts.previousMs),
    needMinutes: input.needMinutes,
    conclusions: input.conclusions,
    chart: {
      labels: input.days.map(dayLabel),
      meetings: counts.perDay,
      hours: counts.perDayMs.map((ms) => ms / MS_PER_HOUR),
    },
    attention: buildAttention(input.ended, input.drafts, input.nowMs),
    services: input.reliability.rows.map((r) => ({
      id: `${r.vendor}/${r.model}`,
      name: VENDOR_LABEL[r.vendor] ?? r.vendor,
      model: r.model,
      p95Ms: r.latency.p95Ms,
      errorRate: r.errorRate,
      health: serviceHealth(r.requests, r.errorRate),
    })),
    recent: input.recent.map(toRecentRow),
  };
}
