import type { MinutesLang } from "@recap/core";
import type { MeetingListItemDto, MinutesBadgeDto } from "@/lib/api-types";
import { formatClock } from "@/lib/format";
import { MINUTES_SOURCE, MINUTES_STALE_STATUS, type StatusSpec } from "@/lib/status";
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

export interface ExportAvailability {
  vi: boolean;
  en: boolean;
  both: boolean;
}

/** Which Word exports exist; the bilingual one needs both languages. */
export function exportAvailability(
  meeting: Pick<MeetingListItemDto, "minutes">,
): ExportAvailability {
  const vi = Boolean(meeting.minutes.vi);
  const en = Boolean(meeting.minutes.en);
  return { vi, en, both: vi && en };
}

/** "Tạo biên bản" only makes sense after the meeting ended. */
export type MinutesAction = "open" | "create" | "unavailable";

export function minutesAction(meeting: MeetingListItemDto): MinutesAction {
  if (hasMinutes(meeting)) return "open";
  return meeting.status === "ended" ? "create" : "unavailable";
}

export const roomHref = (id: string) => `/meetings/${encodeURIComponent(id)}`;
export const minutesHref = (id: string) => `${roomHref(id)}/minutes`;
export const exportHref = (id: string, lang: "vi" | "en" | "both") =>
  `/api/meetings/${encodeURIComponent(id)}/export?lang=${lang}`;
