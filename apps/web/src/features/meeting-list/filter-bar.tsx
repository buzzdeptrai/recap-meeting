"use client";

import { FunnelSimple, X } from "@phosphor-icons/react";
import { Button, Card, Dialog } from "@recap/admin-ui";
import { useState, type ReactNode, type RefObject } from "react";
import type { MeetingListCounts } from "@/lib/api-types";
import {
  activeChips,
  activeFilterCount,
  isFiltered,
  withoutChip,
  type ListState,
  type SortState,
} from "@/lib/list-query";
import { FilterSelects, SearchBox, SortSelect, StatusChips } from "./filter-controls";

export interface FilterBarProps {
  state: ListState;
  counts: MeetingListCounts;
  total: number;
  input: RefObject<HTMLInputElement | null>;
  patch: (change: Partial<ListState>) => void;
  replace: (next: ListState) => void;
  onSort: (sort: SortState) => void;
  onClear: () => void;
  /** View toggle slot (Bảng / Thẻ), desktop only. */
  trailing?: ReactNode;
}

/** Search, status chips, dropdown filters and sort: one card on desktop, a button + dialog on phones. */
export function FilterBar(props: FilterBarProps) {
  const { state, counts, input, patch, onSort, trailing } = props;
  return (
    <Card padding="sm" className="mb-3 flex flex-col gap-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox state={state} patch={patch} input={input} className="sm:max-w-md sm:flex-1" />
        <div className="hidden max-w-full min-w-0 overflow-x-auto sm:block">
          <StatusChips state={state} patch={patch} counts={counts} />
        </div>
        <div className="ml-auto hidden items-center gap-3 sm:flex">{trailing}</div>
        <MobileFilters {...props} />
      </div>
      <div className="hidden flex-wrap items-center gap-3 sm:flex">
        <FilterSelects state={state} patch={patch} />
        <SortSelect state={state} onSort={onSort} className="ml-auto" />
      </div>
      <div className="-mx-1 overflow-x-auto px-1 sm:hidden">
        <StatusChips state={state} patch={patch} counts={counts} />
      </div>
      <ActiveFilters {...props} />
    </Card>
  );
}

function MobileFilters({ state, counts, total, patch, onSort, onClear }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(state);
  return (
    <div className="sm:hidden">
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title="Bộ lọc"
        description={`${total} cuộc họp phù hợp`}
        trigger={
          <Button variant="outline" icon={<FunnelSimple size={16} />}>
            Bộ lọc{count > 0 ? ` (${count})` : ""}
          </Button>
        }
        footer={
          <>
            <Button variant="ghost" onClick={onClear} disabled={!isFiltered(state)}>
              Xóa bộ lọc
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Xem {total} kết quả
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FilterSelects state={state} patch={patch} stacked />
          <SortSelect state={state} onSort={onSort} stacked />
          <p className="sr-only">{counts.all} cuộc họp trước khi lọc theo trạng thái</p>
        </div>
      </Dialog>
    </div>
  );
}

/** Removable chips for every active filter, with the result count and "Xóa bộ lọc". */
function ActiveFilters({ state, total, replace, onClear }: FilterBarProps) {
  const chips = activeChips(state);
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px] text-soft-muted">
      <span aria-live="polite" className="soft-tabular font-semibold text-soft-ink">
        {total} cuộc họp
      </span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => replace(withoutChip(state, chip.key))}
          aria-label={`Bỏ lọc ${chip.label}`}
          className="soft-focus inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full bg-[#f3e8fd] py-1 pr-2 pl-3 text-xs font-bold text-[#6b21a8] transition-colors hover:bg-[#ead7fb]"
        >
          <span className="truncate">{chip.label}</span>
          <X size={12} weight="bold" aria-hidden />
        </button>
      ))}
      {chips.length > 0 ? (
        <button
          type="button"
          onClick={onClear}
          className="soft-focus cursor-pointer rounded-md px-1 text-xs font-bold text-soft-purple hover:underline"
        >
          Xóa bộ lọc
        </button>
      ) : null}
    </div>
  );
}
