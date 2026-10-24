"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { Badge, IconButton, Input, Kbd, SegmentedControl, Select, cn } from "@recap/admin-ui";
import { useEffect, type RefObject } from "react";
import type { MeetingListCounts } from "@/lib/api-types";
import {
  LANG_OPTIONS,
  MAX_QUERY,
  MINUTES_OPTIONS,
  RANGE_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  type LangValue,
  type ListState,
  type MinutesValue,
  type RangeValue,
  type SortState,
  type SortValue,
  type StatusFilter,
} from "@/lib/list-query";

export interface ControlProps {
  state: ListState;
  patch: (change: Partial<ListState>) => void;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** `/` focuses the search box from anywhere that is not already a text field. */
export function useSlashFocus(input: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [input]);
}

interface SearchBoxProps extends ControlProps {
  input: RefObject<HTMLInputElement | null>;
  className?: string;
}

export function SearchBox({ state, patch, input, className }: SearchBoxProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <MagnifyingGlass
        size={16}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-soft-muted"
      />
      <Input
        ref={input}
        type="search"
        role="searchbox"
        aria-label="Tìm trong tiêu đề và nội dung cuộc họp"
        placeholder="Tìm trong tiêu đề và nội dung"
        value={state.q}
        maxLength={MAX_QUERY}
        autoComplete="off"
        onChange={(event) => patch({ q: event.target.value })}
        onKeyDown={(event) => event.key === "Escape" && patch({ q: "" })}
        className="pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="absolute top-1/2 right-2 -translate-y-1/2">
        {state.q ? (
          <IconButton
            label="Xóa từ khóa"
            icon={<X size={14} />}
            onClick={() => {
              patch({ q: "" });
              input.current?.focus();
            }}
            className="size-6 rounded-lg"
          />
        ) : (
          <Kbd>/</Kbd>
        )}
      </span>
    </div>
  );
}

interface StatusChipsProps extends ControlProps {
  counts: MeetingListCounts;
  className?: string;
}

/** Status filter as a segmented chip group; each chip carries its live count. */
export function StatusChips({ state, patch, counts, className }: StatusChipsProps) {
  const options = STATUS_OPTIONS.map((option) => ({
    value: option.value,
    label: (
      <>
        {option.label}
        <Badge
          shape="chip"
          className="soft-tabular min-w-5 justify-center bg-soft-fill px-1.5 py-0 text-[11px] font-semibold text-soft-muted"
        >
          {counts[option.value]}
        </Badge>
      </>
    ),
  }));
  return (
    <SegmentedControl<StatusFilter>
      ariaLabel="Lọc theo trạng thái"
      variant="tabs"
      size="sm"
      options={options}
      value={state.status}
      onValueChange={(status) => patch({ status })}
      className={cn("w-max flex-nowrap", className)}
    />
  );
}

const ACTIVE = "ring-2 ring-soft-purple/40 text-soft-purple";

interface FilterSelectsProps extends ControlProps {
  /** Dialog layout: full-width selects with visible captions. */
  stacked?: boolean;
}

function Caption({ children }: { children: string }) {
  return <span className="mb-1 block text-xs font-bold text-soft-muted">{children}</span>;
}

interface SelectSpec {
  caption: string;
  ariaLabel: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}

function selectSpecs({ state, patch }: ControlProps): SelectSpec[] {
  return [
    {
      caption: "Biên bản",
      ariaLabel: "Lọc theo biên bản",
      options: MINUTES_OPTIONS,
      value: state.minutes,
      onChange: (v) => patch({ minutes: v as MinutesValue }),
    },
    {
      caption: "Ngôn ngữ",
      ariaLabel: "Lọc theo ngôn ngữ nói",
      options: LANG_OPTIONS,
      value: state.lang,
      onChange: (v) => patch({ lang: v as LangValue }),
    },
    {
      caption: "Thời gian",
      ariaLabel: "Lọc theo thời gian",
      options: RANGE_OPTIONS,
      value: state.range,
      onChange: (v) => patch(rangePatch(v as RangeValue)),
    },
  ];
}

/** Biên bản, Ngôn ngữ, Thời gian (+ custom dates). Sorting is a separate control. */
export function FilterSelects({ state, patch, stacked = false }: FilterSelectsProps) {
  return (
    <>
      {selectSpecs({ state, patch }).map((spec) => {
        const select = (
          <Select
            ariaLabel={spec.ariaLabel}
            prefix={stacked ? undefined : `${spec.caption}:`}
            options={spec.options}
            value={spec.value}
            onValueChange={spec.onChange}
            className={cn(stacked && "w-full", spec.value !== "all" && ACTIVE)}
          />
        );
        return stacked ? (
          <div key={spec.caption}>
            <Caption>{spec.caption}</Caption>
            {select}
          </div>
        ) : (
          <span key={spec.caption}>{select}</span>
        );
      })}
      {state.range === "custom" ? (
        <DateRange state={state} patch={patch} stacked={stacked} />
      ) : null}
    </>
  );
}

const rangePatch = (range: RangeValue): Partial<ListState> =>
  range === "custom" ? { range } : { range, from: "", to: "" };

function DateRange({ state, patch, stacked }: FilterSelectsProps) {
  return (
    <div className={cn("flex items-center gap-2", stacked && "w-full")}>
      <Input
        type="date"
        aria-label="Từ ngày"
        value={state.from}
        max={state.to || undefined}
        onChange={(e) => patch({ from: e.target.value })}
        className="h-10 min-w-0 flex-1 py-0 text-[13px] sm:w-40 sm:flex-none"
      />
      <span aria-hidden className="text-soft-muted">
        –
      </span>
      <Input
        type="date"
        aria-label="Đến ngày"
        value={state.to}
        min={state.from || undefined}
        onChange={(e) => patch({ to: e.target.value })}
        className="h-10 min-w-0 flex-1 py-0 text-[13px] sm:w-40 sm:flex-none"
      />
    </div>
  );
}

interface SortSelectProps {
  state: ListState;
  onSort: (sort: SortState) => void;
  className?: string;
  stacked?: boolean;
}

/** "Liên quan nhất" exists only while searching; it is the `auto` sort then. */
export function SortSelect({ state, onSort, className, stacked }: SortSelectProps) {
  const searching = state.q.trim() !== "";
  const value = state.sort === "auto" ? (searching ? "relevance" : "newest") : state.sort;
  const options = SORT_OPTIONS.filter((o) => searching || o.value !== "relevance");
  return (
    <div className={className}>
      {stacked ? <Caption>Sắp xếp</Caption> : null}
      <Select
        ariaLabel="Sắp xếp danh sách"
        prefix={stacked ? undefined : "Sắp xếp:"}
        options={options}
        value={value}
        onValueChange={(v) => onSort(toSortState(v as SortValue | "relevance", searching))}
        className={stacked ? "w-full" : undefined}
      />
    </div>
  );
}

function toSortState(value: SortValue | "relevance", searching: boolean): SortState {
  if (value === "relevance") return "auto";
  if (value === "newest" && !searching) return "auto";
  return value;
}
