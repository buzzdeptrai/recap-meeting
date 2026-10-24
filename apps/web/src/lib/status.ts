/**
 * Single source of truth for every status label and colour in the app (docs/DESIGN.md "Status system").
 * Colour is never the only cue: each status also has a text label, and `StatusBadge` adds a dot.
 *
 * Rules
 * - green = done / healthy / configured, grey = not started or not set, magenta = live (REC),
 *   red = failed or missing, purple = AI / example data.
 * - amber (`conclusion`) belongs to conclusions and decisions only: topic "Đã thống nhất" in minutes and the room.
 *   Warnings that are not decisions use `warn` (yellow, warning icon colour), never `conclusion`.
 */
import type { TopicStatus } from "@recap/core";
import type { MeetingStatus } from "@recap/db";

export type StatusTone = "neutral" | "ok" | "warn" | "error" | "rec" | "purple" | "conclusion";
export type DotTone = "ok" | "warn" | "bad" | "rec" | "idle";

export interface StatusSpec {
  label: string;
  tone: StatusTone;
}

export const MEETING_STATUS: Record<MeetingStatus, StatusSpec> = {
  draft: { label: "Nháp", tone: "neutral" },
  live: { label: "Đang họp", tone: "rec" },
  ended: { label: "Đã kết thúc", tone: "ok" },
};

export const TOPIC_STATUS: Record<TopicStatus, StatusSpec> = {
  decided: { label: "Đã thống nhất", tone: "conclusion" },
  open: { label: "Còn bỏ ngỏ", tone: "neutral" },
  rejected: { label: "Đã loại", tone: "error" },
};

export type RecordingState = "idle" | "recording" | "reconnecting";

export const RECORDING_STATUS: Record<RecordingState, StatusSpec> = {
  idle: { label: "Chưa bắt đầu", tone: "neutral" },
  recording: { label: "REC", tone: "rec" },
  reconnecting: { label: "Mất kết nối", tone: "error" },
};

export type ServiceHealthKey = "ok" | "warn" | "bad" | "idle";

export const SERVICE_HEALTH: Record<ServiceHealthKey, StatusSpec & { dot: DotTone }> = {
  ok: { label: "Hoạt động", tone: "ok", dot: "ok" },
  warn: { label: "Có lỗi", tone: "warn", dot: "warn" },
  bad: { label: "Lỗi nhiều", tone: "error", dot: "bad" },
  idle: { label: "Chưa có dữ liệu", tone: "neutral", dot: "idle" },
};

export type ProviderState = "configured" | "missing" | "unused";

export const PROVIDER_STATUS: Record<ProviderState, StatusSpec & { dot: DotTone }> = {
  configured: { label: "Đã cấu hình", tone: "ok", dot: "ok" },
  missing: { label: "Thiếu khóa", tone: "error", dot: "bad" },
  unused: { label: "Chưa dùng", tone: "neutral", dot: "idle" },
};

export function providerState(p: { configured: boolean; required: boolean }): ProviderState {
  if (p.configured) return "configured";
  return p.required ? "missing" : "unused";
}

export type UserState = "active" | "disabled";

export const USER_STATUS: Record<UserState, StatusSpec> = {
  active: { label: "Hoạt động", tone: "ok" },
  disabled: { label: "Đã khóa", tone: "neutral" },
};

export type PricingState = "verified" | "example";

/** "Ví dụ" marks figures that are illustrative, everywhere (usage header, pricing table). */
export const PRICING_STATUS: Record<PricingState, StatusSpec> = {
  verified: { label: "Đã xác minh", tone: "ok" },
  example: { label: "Ví dụ", tone: "purple" },
};

export type MinutesSource = "ai" | "edited";

export const MINUTES_SOURCE: Record<MinutesSource, StatusSpec> = {
  ai: { label: "AI tạo", tone: "purple" },
  edited: { label: "Đã chỉnh sửa", tone: "neutral" },
};

export const UNSAVED_STATUS: StatusSpec = { label: "Chưa lưu", tone: "warn" };

/** Minutes whose transcript/marks changed after generation. Yellow `warn` (amber is for conclusions). */
export const MINUTES_STALE_STATUS: StatusSpec = { label: "Cần cập nhật", tone: "warn" };

export const NO_MINUTES_LABEL = "Chưa có biên bản";
