import type { MinutesLang } from "@recap/core";
import type { Repositories } from "@recap/db";
import {
  buildMinutesDocx,
  exportMinutesMarkdown,
  languagesFor,
  type ExportMode,
} from "@recap/export";
import { getRepositories } from "./db";
import { ServiceError } from "./service-error";

export const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

export type ExportFormat = "docx" | "md";

export interface MarkdownExportResult {
  body: string;
  contentDisposition: string;
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentDisposition: string;
}

const LANG_NAME: Record<MinutesLang, string> = { vi: "tiếng Việt", en: "tiếng Anh" };
const MAX_BASENAME = 80;

/** Strips path separators, control and reserved characters; falls back when nothing is left. */
export function sanitizeTitle(title: string): string {
  const cleaned = title
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, MAX_BASENAME)
    .trim();
  return cleaned || "bien-ban-cuoc-hop";
}

const asciiOnly = (s: string) =>
  s
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\%;]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const rfc5987 = (s: string) =>
  encodeURIComponent(s).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function buildContentDisposition(
  title: string,
  mode: ExportMode,
  format: ExportFormat = "docx",
): string {
  const base = `${sanitizeTitle(title)} (${mode})`;
  const ascii = asciiOnly(base).replace(/^[\s.]+/, "") || `minutes-${mode}`;
  return `attachment; filename="${ascii}.${format}"; filename*=UTF-8''${rfc5987(`${base}.${format}`)}`;
}

/** Absent `format` means docx (existing behaviour); anything unknown is rejected. */
export function parseExportFormat(raw: string | null): ExportFormat | null {
  if (raw === null) return "docx";
  return raw === "docx" || raw === "md" ? raw : null;
}

export function parseExportMode(raw: string | null): ExportMode | null {
  return raw === "vi" || raw === "en" || raw === "both" ? raw : null;
}

function missingMinutes(missing: MinutesLang[]): ServiceError {
  const names = missing.map((l) => LANG_NAME[l]).join(" và ");
  return new ServiceError(
    404,
    "MINUTES_NOT_FOUND",
    `Chưa có biên bản ${names}. Hãy tạo biên bản trước khi xuất file.`,
  );
}

interface ExportDeps {
  repos: Repositories;
}

function loadMinutes(meetingId: string, mode: ExportMode, repos: Repositories) {
  const meeting = repos.meetings.get(meetingId);
  if (!meeting) throw new ServiceError(404, "NOT_FOUND", "Không tìm thấy cuộc họp này.");
  const stored = languagesFor(mode).map(
    (lang) => [lang, repos.minutes.get(meetingId, lang)] as const,
  );
  const missing = stored.filter(([, m]) => !m).map(([lang]) => lang);
  if (missing.length > 0) throw missingMinutes(missing);
  const minutes = Object.fromEntries(stored.map(([lang, m]) => [lang, m?.content]));
  return { meeting, minutes };
}

export async function exportMinutesDocx(
  meetingId: string,
  mode: ExportMode,
  deps: ExportDeps = { repos: getRepositories() },
): Promise<ExportResult> {
  const { meeting, minutes } = loadMinutes(meetingId, mode, deps.repos);
  const buffer = await buildMinutesDocx({ meeting, minutes, mode });
  const contentDisposition = buildContentDisposition(meeting.title, mode);
  return { buffer, filename: sanitizeTitle(meeting.title), contentDisposition };
}

export async function exportMinutesMarkdownFile(
  meetingId: string,
  mode: ExportMode,
  deps: ExportDeps = { repos: getRepositories() },
): Promise<MarkdownExportResult> {
  const { meeting, minutes } = loadMinutes(meetingId, mode, deps.repos);
  const body = exportMinutesMarkdown({ meeting, minutes, mode });
  return { body, contentDisposition: buildContentDisposition(meeting.title, mode, "md") };
}
