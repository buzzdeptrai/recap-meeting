import type { MinutesLang } from "@recap/core";

export type ExportMode = "vi" | "en" | "both";
export type ExportFormat = "docx" | "md";

/** Which languages already have stored minutes. */
export type MinutesAvailability = Record<MinutesLang, boolean>;

export interface ExportOption {
  mode: ExportMode;
  format: ExportFormat;
  label: string;
  href: string;
  enabled: boolean;
  /** Why the option is disabled; null when enabled. */
  reason: string | null;
}

const LANG_NAME: Record<MinutesLang, string> = { vi: "tiếng Việt", en: "tiếng Anh" };

export const NO_AVAILABILITY: MinutesAvailability = { vi: false, en: false };

const MODES: ReadonlyArray<{ mode: ExportMode; label: string; langs: MinutesLang[] }> = [
  { mode: "vi", label: "Tiếng Việt", langs: ["vi"] },
  { mode: "en", label: "Tiếng Anh", langs: ["en"] },
  { mode: "both", label: "Song ngữ", langs: ["vi", "en"] },
];

export function exportHref(
  meetingId: string,
  mode: ExportMode,
  format: ExportFormat = "docx",
): string {
  const base = `/api/meetings/${encodeURIComponent(meetingId)}/export?lang=${mode}`;
  return format === "docx" ? base : `${base}&format=${format}`;
}

/** Export choices; an option is enabled only when every language it needs has minutes. */
export function exportOptions(
  meetingId: string,
  available: MinutesAvailability,
  format: ExportFormat = "docx",
): ExportOption[] {
  return MODES.map(({ mode, label, langs }) => {
    const missing = langs.filter((lang) => !available[lang]);
    const names = missing.map((lang) => LANG_NAME[lang]).join(" và ");
    return {
      mode,
      format,
      label,
      href: exportHref(meetingId, mode, format),
      enabled: missing.length === 0,
      reason: missing.length === 0 ? null : `Chưa có biên bản ${names}`,
    };
  });
}

export const hasAnyMinutes = (available: MinutesAvailability) => available.vi || available.en;

/** Availability only grows while the page is open (generate and save both create minutes). */
export function withMinutes(
  available: MinutesAvailability,
  lang: MinutesLang,
): MinutesAvailability {
  return available[lang] ? available : { ...available, [lang]: true };
}
