/**
 * URL state of the meetings list (`?q=&status=&minutes=&lang=&range=&from=&to=&sort=`).
 * Shared by the server component, the REST schema and the client: every control maps to exactly
 * one param, defaults are omitted, unknown values fall back to the default.
 */
import type { MeetingStatus } from "@recap/db";
import { isDayKey } from "./vn-time";

export const STATUS_VALUES = ["draft", "live", "ended"] as const;
export const MINUTES_VALUES = ["none", "vi", "en", "stale", "need"] as const;
export const LANG_VALUES = ["vi", "en", "multi"] as const;
export const RANGE_VALUES = ["today", "7d", "30d", "month", "custom"] as const;
export const SORT_VALUES = ["newest", "oldest", "duration", "name"] as const;

export type StatusFilter = MeetingStatus | "all";
export type MinutesValue = (typeof MINUTES_VALUES)[number] | "all";
export type LangValue = (typeof LANG_VALUES)[number] | "all";
export type RangeValue = (typeof RANGE_VALUES)[number] | "all";
export type SortValue = (typeof SORT_VALUES)[number];
/** `auto` = relevance when searching, else newest first (omitted from the URL). */
export type SortState = SortValue | "auto";

export interface ListState {
  q: string;
  status: StatusFilter;
  minutes: MinutesValue;
  lang: LangValue;
  range: RangeValue;
  /** `YYYY-MM-DD`, only with `range=custom`. */
  from: string;
  to: string;
  sort: SortState;
}

export const MAX_QUERY = 200;
export const PAGE_SIZE = 20;

export const DEFAULT_STATE: ListState = {
  q: "",
  status: "all",
  minutes: "all",
  lang: "all",
  range: "all",
  from: "",
  to: "",
  sort: "auto",
};

const pick = <T extends string>(allowed: readonly T[], value: string | undefined): T | undefined =>
  allowed.find((candidate) => candidate === value);

type Raw = Record<string, string | string[] | undefined> | URLSearchParams;

function read(raw: Raw, key: string): string | undefined {
  if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined;
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Tolerant parse of page search params; never throws. */
export function parseListState(raw: Raw): ListState {
  const rawRange = read(raw, "range");
  const from = read(raw, "from") ?? "";
  const to = read(raw, "to") ?? "";
  const custom = rawRange === "custom" || (rawRange === undefined && (from || to));
  const range = custom ? "custom" : (pick(RANGE_VALUES, rawRange) ?? "all");
  return {
    q: (read(raw, "q") ?? "").trim().slice(0, MAX_QUERY),
    status: pick(STATUS_VALUES, read(raw, "status")) ?? "all",
    minutes: pick(MINUTES_VALUES, read(raw, "minutes")) ?? "all",
    lang: pick(LANG_VALUES, read(raw, "lang")) ?? "all",
    range,
    from: range === "custom" && isDayKey(from) ? from : "",
    to: range === "custom" && isDayKey(to) ? to : "",
    sort: pick(SORT_VALUES, read(raw, "sort")) ?? "auto",
  };
}

/** Query string for the URL / REST call: only non-default values. */
export function toSearchParams(state: ListState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.status !== "all") params.set("status", state.status);
  if (state.minutes !== "all") params.set("minutes", state.minutes);
  if (state.lang !== "all") params.set("lang", state.lang);
  if (state.range !== "all") params.set("range", state.range);
  if (state.range === "custom") {
    if (state.from) params.set("from", state.from);
    if (state.to) params.set("to", state.to);
  }
  if (state.sort !== "auto") params.set("sort", state.sort);
  return params;
}

/** Linkable page URL: `/meetings?status=ended&minutes=none`. */
export function listHref(state: ListState): string {
  const query = toSearchParams(state).toString();
  return query ? `/meetings?${query}` : "/meetings";
}

/** Same state, ignoring the search box's surrounding whitespace. */
export function sameState(a: ListState, b: ListState): boolean {
  return listHref(a) === listHref(b);
}

/** Filters (everything except q and sort) that are not at their default. */
export function activeFilterCount(state: ListState): number {
  return [state.status, state.minutes, state.lang, state.range].filter((v) => v !== "all").length;
}

export const isFiltered = (state: ListState) =>
  state.q.trim() !== "" || activeFilterCount(state) > 0;

/** Labels for the dropdowns and the removable chips (single place for the Vietnamese copy). */
export const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "live", label: "Đang họp" },
  { value: "ended", label: "Đã kết thúc" },
  { value: "draft", label: "Nháp" },
];

export const MINUTES_OPTIONS: ReadonlyArray<{ value: MinutesValue; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "none", label: "Chưa có biên bản" },
  { value: "vi", label: "Có biên bản VI" },
  { value: "en", label: "Có biên bản EN" },
  { value: "stale", label: "Cần cập nhật" },
  { value: "need", label: "Chờ tạo/duyệt" },
];

export const LANG_OPTIONS: ReadonlyArray<{ value: LangValue; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
  { value: "multi", label: "Lẫn Anh–Việt" },
];

export const RANGE_OPTIONS: ReadonlyArray<{ value: RangeValue; label: string }> = [
  { value: "all", label: "Mọi lúc" },
  { value: "today", label: "Hôm nay" },
  { value: "7d", label: "7 ngày qua" },
  { value: "30d", label: "30 ngày qua" },
  { value: "month", label: "Tháng này" },
  { value: "custom", label: "Tùy chọn khoảng ngày" },
];

export const SORT_OPTIONS: ReadonlyArray<{ value: SortValue | "relevance"; label: string }> = [
  { value: "relevance", label: "Liên quan nhất" },
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
  { value: "duration", label: "Thời lượng" },
  { value: "name", label: "Tên A–Z" },
];

const labelOf = <V extends string>(options: ReadonlyArray<{ value: V; label: string }>, v: V) =>
  options.find((o) => o.value === v)?.label ?? v;

function rangeLabel(state: ListState): string {
  if (state.range !== "custom") return labelOf(RANGE_OPTIONS, state.range);
  const fmt = (key: string) => key.split("-").reverse().join("/");
  if (state.from && state.to) return `${fmt(state.from)} – ${fmt(state.to)}`;
  if (state.from) return `Từ ${fmt(state.from)}`;
  if (state.to) return `Đến ${fmt(state.to)}`;
  return "Tùy chọn";
}

export interface ActiveChip {
  key: "q" | "status" | "minutes" | "lang" | "range";
  label: string;
}

/** One removable chip per active filter (the search term included). */
export function activeChips(state: ListState): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (state.q.trim()) chips.push({ key: "q", label: `“${state.q.trim()}”` });
  if (state.status !== "all")
    chips.push({ key: "status", label: labelOf(STATUS_OPTIONS, state.status) });
  if (state.minutes !== "all")
    chips.push({ key: "minutes", label: `Biên bản: ${labelOf(MINUTES_OPTIONS, state.minutes)}` });
  if (state.lang !== "all")
    chips.push({ key: "lang", label: `Ngôn ngữ: ${labelOf(LANG_OPTIONS, state.lang)}` });
  if (state.range !== "all") chips.push({ key: "range", label: rangeLabel(state) });
  return chips;
}

/** State with one chip's filter reset. */
export function withoutChip(state: ListState, key: ActiveChip["key"]): ListState {
  if (key === "range") return { ...state, range: "all", from: "", to: "" };
  return { ...state, [key]: DEFAULT_STATE[key] };
}

/** Clears every filter but keeps sort. */
export const clearedState = (state: ListState): ListState => ({
  ...DEFAULT_STATE,
  sort: state.sort,
});
