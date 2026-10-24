import type { MinutesLang } from "@recap/core";
import type { MeetingListItemDto, MinutesBadgeDto } from "@/lib/api-types";
import { formatClock } from "@/lib/format";
import type { MinutesAvailability } from "@/features/minutes/export-options";
import {
  MINUTES_SOURCE,
  MINUTES_STALE_STATUS,
  type StatusSpec,
  type StatusTone,
} from "@/lib/status";
import { formatVnTime } from "@/lib/vn-time";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_LANGS: readonly MinutesLang[] = ["vi", "en"];

const pad = (n: number) => String(n).padStart(2, "0");

/** `hh:mm:ss` or an em dash while the meeting has no recorded duration. */
export function durationLabel(meeting: Pick<MeetingListItemDto, "durationMs">): string {
  return meeting.durationMs === null ? "—" : formatClock(meeting.durationMs);
}

/** Sum of durations as `giờ:phút` (`12:05`). */
export function formatTotalDuration(ms: number): string {
  const minutes = Math.round(Math.max(0, ms) / MS_PER_MINUTE);
  return `${Math.floor(minutes / MINUTES_PER_HOUR)}:${pad(minutes % MINUTES_PER_HOUR)}`;
}

/** `12:42 – 12:44` wall clock (Vietnam time) of the recording, or null when it never started. */
export function wallClockRange(
  meeting: Pick<MeetingListItemDto, "startedAt" | "endedAt">,
): string | null {
  if (!meeting.startedAt) return null;
  const start = formatVnTime(meeting.startedAt);
  return meeting.endedAt ? `${start} – ${formatVnTime(meeting.endedAt)}` : `từ ${start}`;
}

export type SubLine =
  { kind: "snippet"; text: string } | { kind: "agenda" | "conclusion"; text: string };

/** Muted second line: search snippet, else the agenda's first line, else the first conclusion. */
export function subLine(meeting: MeetingListItemDto): SubLine | null {
  if (meeting.snippet) return { kind: "snippet", text: meeting.snippet };
  if (meeting.agendaPreview) return { kind: "agenda", text: meeting.agendaPreview };
  if (meeting.firstConclusion) return { kind: "conclusion", text: meeting.firstConclusion };
  return null;
}

export interface MinutesChip {
  lang: MinutesLang;
  spec: StatusSpec;
}

/** Stale wins over the source: "Cần cập nhật" is what the reader must act on. */
export function minutesSpec(badge: MinutesBadgeDto): StatusSpec {
  return badge.stale ? MINUTES_STALE_STATUS : MINUTES_SOURCE[badge.source];
}

export function minutesChips(meeting: Pick<MeetingListItemDto, "minutes">): MinutesChip[] {
  return MINUTES_LANGS.flatMap((lang) => {
    const badge = meeting.minutes[lang];
    return badge ? [{ lang, spec: minutesSpec(badge) }] : [];
  });
}

export const hasMinutes = (meeting: Pick<MeetingListItemDto, "minutes">) =>
  minutesChips(meeting).length > 0;

/** Which languages already have stored minutes (input of the shared export helper). */
export function minutesAvailability(
  meeting: Pick<MeetingListItemDto, "minutes">,
): MinutesAvailability {
  return { vi: Boolean(meeting.minutes.vi), en: Boolean(meeting.minutes.en) };
}

/** "Tạo biên bản" only makes sense after the meeting ended. */
export type MinutesAction = "open" | "create" | "unavailable";

export function minutesAction(meeting: MeetingListItemDto): MinutesAction {
  if (hasMinutes(meeting)) return "open";
  return meeting.status === "ended" ? "create" : "unavailable";
}

export const roomHref = (id: string) => `/meetings/${encodeURIComponent(id)}`;
export const minutesHref = (id: string) => `${roomHref(id)}/minutes`;

export interface QuickAction {
  kind: "minutes" | "room";
  label: string;
  href: string;
}

/** The single action a row shows on hover/focus: the minutes when they exist, else the room. */
export function quickAction(meeting: MeetingListItemDto): QuickAction {
  if (hasMinutes(meeting)) {
    return { kind: "minutes", label: "Biên bản", href: minutesHref(meeting.id) };
  }
  return { kind: "room", label: "Mở phòng", href: roomHref(meeting.id) };
}

export type ChipTone = "neutral" | "info" | "ok" | "warn" | "decision" | "danger";

const CHIP_TONE: Record<StatusTone, ChipTone> = {
  neutral: "neutral",
  ok: "ok",
  warn: "warn",
  error: "danger",
  rec: "danger",
  purple: "info",
  conclusion: "decision",
};

/** Maps a `lib/status.ts` tone onto the kit `Chip` tone. */
export const chipToneFor = (tone: StatusTone): ChipTone => CHIP_TONE[tone];

/** "12 cuộc họp", or "3 cuộc họp phù hợp" while a search or filter is on. */
export function listCountLabel(total: number, filtered: boolean): string {
  if (!filtered) return `${total} cuộc họp`;
  return total === 0 ? "Không có cuộc họp nào phù hợp" : `${total} cuộc họp phù hợp`;
}
