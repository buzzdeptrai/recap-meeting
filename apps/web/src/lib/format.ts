import type { SourceLang, TargetLang } from "@recap/core";

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;

const pad = (value: number) => String(value).padStart(2, "0");

/** 00:12:47 — offsets and durations, always hh:mm:ss. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  return `${pad(hours)}:${pad(minutes)}:${pad(total % SECONDS_PER_MINUTE)}`;
}

const dayFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 21/10/2026 14:05 */
export function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return `${dayFormat.format(parsed)} ${timeFormat.format(parsed)}`;
}

export const SOURCE_LANG_OPTIONS: ReadonlyArray<{ value: SourceLang; label: string }> = [
  { value: "auto", label: "Tự động" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
  { value: "multi", label: "Lẫn Anh–Việt" },
];

export const TARGET_LANG_OPTIONS: ReadonlyArray<{ value: TargetLang; label: string }> = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
];

const SOURCE_SHORT: Record<SourceLang, string> = {
  auto: "AUTO",
  vi: "VI",
  en: "EN",
  multi: "VI+EN",
};

/** `VI → EN` for the list; em dash when the meeting has no languages yet. */
export function formatLangPair(source: SourceLang | null, target: TargetLang | null): string {
  if (!source || !target) return "—";
  return `${SOURCE_SHORT[source]} → ${target.toUpperCase()}`;
}

/** Seconds with one decimal: 0.9 s. */
export function formatSeconds(ms: number): string {
  return `${(ms / MS_PER_SECOND).toFixed(1)} s`;
}

/** 2026-10-22 -> 22/10/2026 (date-only strings from config); anything else is returned unchanged. */
export function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}
