"use client";

import { FunnelSimple, Plus, X } from "@phosphor-icons/react";
import { Button, Chip, Dialog, FloatCard, buttonVariants } from "@recap/admin-ui";
import Link from "next/link";
import { useState, type ReactNode, type RefObject } from "react";
import type { MeetingListCounts, MeetingListTotals } from "@/lib/api-types";
import {
  activeChips,
  activeFilterCount,
  isFiltered,
  withoutChip,
  type ListState,
  type SortState,
} from "@/lib/list-query";
import { FilterSelects, SearchBox, SortSelect, StatusChips } from "./filter-controls";
import { listCountLabel } from "./meeting-format";

export interface FilterBarProps {
  state: ListState;
  counts: MeetingListCounts;
  totals: MeetingListTotals;
  total: number;
  input: RefObject<HTMLInputElement | null>;
  patch: (change: Partial<ListState>) => void;
  replace: (next: ListState) => void;
  onSort: (sort: SortState) => void;
  onClear: () => void;
  /** View toggle slot (Bảng / Thẻ), hidden on phones. */
  trailing?: ReactNode;
}

/** The one primary action of the page, top right of the header card. */
export function NewMeetingButton() {
  return (
    <Link
      href="/meetings/new"
      className={buttonVariants({ variant: "primary", size: "md", shape: "pill" })}
    >
      <Plus size={16} weight="bold" />
      Cuộc họp mới
    </Link>
  );
}

/** Title only, no actions: used while there is nothing to list yet (the empty card owns the button). */
export function PlainHeader() {
  return (
    <FloatCard as="header" className="mb-4">
      <h1 className="text-xl font-bold">Cuộc họp</h1>
    </FloatCard>
  );
}

/** Header card: title + count, the primary button, a pill search, soft segmented controls, one filter button. */
export function FilterBar(props: FilterBarProps) {
  const { state, counts, input, patch, trailing } = props;
  return (
    <FloatCard as="header" className="mb-4" bodyClassName="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <TitleBlock {...props} />
        <NewMeetingButton />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          state={state}
          patch={patch}
          input={input}
          className="order-1 min-w-0 flex-1 basis-40 sm:min-w-56 sm:basis-64"
        />
        <div className="order-3 max-w-full min-w-0 max-sm:w-full overflow-x-auto sm:order-2">
          <StatusChips state={state} patch={patch} counts={counts} />
        </div>
        <span className="order-3 max-sm:hidden sm:ml-auto">{trailing}</span>
        <span className="order-2 sm:order-4">
          <FilterDialog {...props} />
        </span>
      </div>
      <ActiveFilters {...props} />
    </FloatCard>
  );
}

function TitleBlock({ state, totals, total, replace }: FilterBarProps) {
  const need: ListState = { ...state, status: "ended", minutes: "need" };
  const needActive = state.minutes === "need" && state.status === "ended";
  return (
    <div className="min-w-0">
      <h1 className="text-xl font-bold">Cuộc họp</h1>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-soft-muted">
        <span aria-live="polite" className="soft-tabular">
          {listCountLabel(total, isFiltered(state))}
        </span>
        {totals.needMinutes > 0 && !needActive ? (
          <>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => replace(need)}
              className="soft-focus cursor-pointer rounded-md font-semibold text-soft-accent-ink hover:underline"
            >
              {totals.needMinutes} cuộc họp chờ biên bản
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}

function FilterDialog({ state, total, patch, onSort, onClear }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(state);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="sm"
      title="Bộ lọc"
      description={`${total} cuộc họp phù hợp`}
      trigger={
        <Button variant="outline" shape="pill" icon={<FunnelSimple size={16} />}>
          Bộ lọc{count > 0 ? ` (${count})` : ""}
        </Button>
      }
      footer={
        <>
          <Button variant="ghost" shape="pill" onClick={onClear} disabled={!isFiltered(state)}>
            Xóa bộ lọc
          </Button>
          <Button variant="primary" shape="pill" onClick={() => setOpen(false)}>
            Xem {total} kết quả
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FilterSelects state={state} patch={patch} stacked />
        <SortSelect state={state} onSort={onSort} stacked />
      </div>
    </Dialog>
  );
}

/** Removable chips for every active filter, with "Xóa bộ lọc". */
function ActiveFilters({ state, replace, onClear }: FilterBarProps) {
  const chips = activeChips(state);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => replace(withoutChip(state, chip.key))}
          aria-label={`Bỏ lọc ${chip.label}`}
          className="soft-focus max-w-full cursor-pointer rounded-full"
        >
          <Chip tone="info" size="lg" className="max-w-full pr-2">
            <span className="truncate">{chip.label}</span>
            <X size={12} weight="bold" aria-hidden />
          </Chip>
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="soft-focus cursor-pointer rounded-md px-1 text-xs font-semibold text-soft-accent-ink hover:underline"
      >
        Xóa bộ lọc
      </button>
    </div>
  );
}
