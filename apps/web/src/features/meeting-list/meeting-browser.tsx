"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { Button, FloatCard, IconBadge } from "@recap/admin-ui";
import { useRef } from "react";
import type { MeetingListDto } from "@/lib/api-types";
import { isFiltered, type ListState } from "@/lib/list-query";
import { EmptyMeetings, NoResults } from "./empty-meetings";
import { FilterBar, PlainHeader } from "./filter-bar";
import { useSlashFocus } from "./filter-controls";
import { MeetingListView } from "./meeting-list-view";
import { MeetingSkeleton } from "./meeting-skeleton";
import { useCopyLink } from "./use-copy-link";
import { useMeetingList, type MeetingListController } from "./use-meeting-list";
import { ViewToggle, useViewMode } from "./view-mode";

interface MeetingBrowserProps {
  initial: MeetingListDto;
  initialState: ListState;
  /** Epoch ms of the server render: "Hôm nay" and "tuần này" are relative to it. */
  now: number;
}

export function MeetingBrowser({ initial, initialState, now }: MeetingBrowserProps) {
  const list = useMeetingList(initial, initialState);
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useViewMode();
  const { copy, notice } = useCopyLink();
  useSlashFocus(input);
  const { state, counts, totals, total, error } = list;
  const nothingAtAll = counts.all === 0 && !isFiltered(state) && !list.busy;

  if (nothingAtAll && !error) {
    return (
      <>
        <PlainHeader />
        <EmptyMeetings />
      </>
    );
  }
  return (
    <>
      <FilterBar
        state={state}
        counts={counts}
        totals={totals}
        total={total}
        input={input}
        patch={list.patch}
        replace={list.replace}
        onSort={list.setSort}
        onClear={list.clear}
        trailing={<ViewToggle mode={mode} onChange={setMode} />}
      />
      {error ? <ErrorBanner message={error} onRetry={list.retry} /> : null}
      <Results list={list} mode={mode} now={now} onCopy={copy} />
      <Footer list={list} />
      {notice}
    </>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <FloatCard
      as="div"
      role="alert"
      className="mb-4"
      bodyClassName="flex flex-wrap items-center gap-3 !py-3"
    >
      <IconBadge tone="neutral" size="md" className="bg-soft-danger-bg text-soft-danger-ink">
        <WarningCircle />
      </IconBadge>
      <p className="min-w-0 flex-1 text-[13px] text-soft-ink">{message}</p>
      <Button size="sm" variant="outline" shape="pill" onClick={onRetry}>
        Thử lại
      </Button>
    </FloatCard>
  );
}

interface ResultsProps {
  list: MeetingListController;
  mode: "table" | "cards";
  now: number;
  onCopy: (id: string) => void;
}

function Results({ list, mode, now, onCopy }: ResultsProps) {
  const { items, state, loading, error } = list;
  if (loading) return <MeetingSkeleton />;
  if (items.length === 0) {
    if (error || list.busy) return null;
    return <NoResults term={state.q.trim()} onClear={list.clear} />;
  }
  return (
    <div
      className={list.busy ? "opacity-70 transition-opacity" : "transition-opacity"}
      aria-busy={list.busy}
    >
      <MeetingListView meetings={items} state={state} mode={mode} now={now} onCopy={onCopy} />
    </div>
  );
}

function Footer({ list }: { list: MeetingListController }) {
  const { items, total, loading, loadingMore } = list;
  if (loading || items.length === 0) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-[13px] text-soft-muted">
      <span className="soft-tabular">
        Hiển thị <strong className="font-bold text-soft-ink">{items.length}</strong> / {total}
      </span>
      {items.length < total ? (
        <Button
          size="sm"
          variant="outline"
          shape="pill"
          onClick={list.loadMore}
          loading={loadingMore}
        >
          {loadingMore ? "Đang tải" : "Tải thêm"}
        </Button>
      ) : null}
    </div>
  );
}
