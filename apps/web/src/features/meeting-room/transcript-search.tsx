"use client";

import { CaretDown, CaretUp, List, MagnifyingGlass, X } from "@phosphor-icons/react";
import { IconButton, Input } from "@recap/admin-ui";
import type { KeyboardEvent, Ref } from "react";
import { Snippet } from "@/features/meeting-list/snippet";
import { formatClock } from "@/lib/format";
import type { TranscriptHitDto } from "@/lib/api-types";
import type { SearchState } from "./search-state";
import type { TranscriptSearchApi } from "./use-transcript-search";

const MAX_QUERY_CHARS = 200;

/** "n kết quả" with the position of the current hit; the live region announces it. */
export function resultsSummary(state: SearchState): string {
  if (state.query.trim() === "") return "";
  if (state.status === "error") return "Không tìm được";
  if (state.status === "loading" && state.hits.length === 0) return "Đang tìm…";
  if (state.hits.length === 0) return "Không có kết quả";
  const count = `${state.hits.length}${state.truncated ? "+" : ""}`;
  return `${state.active + 1}/${count} kết quả`;
}

interface TranscriptSearchProps {
  api: TranscriptSearchApi;
  inputRef: Ref<HTMLInputElement>;
  onClose: () => void;
}

/** Enter / arrows step through the hits (Shift+Enter and ArrowUp go back). */
function stepOnKey(
  event: KeyboardEvent<HTMLInputElement>,
  dispatch: TranscriptSearchApi["dispatch"],
) {
  if (event.key !== "Enter" && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const back = event.key === "ArrowUp" || (event.key === "Enter" && event.shiftKey);
  dispatch({ type: "step", delta: back ? -1 : 1 });
}

export function TranscriptSearch({ api, inputRef, onClose }: TranscriptSearchProps) {
  const { state, dispatch } = api;
  const hasHits = state.hits.length > 0;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => stepOnKey(event, dispatch);

  return (
    <div
      role="search"
      className="mx-3 mt-3 shrink-0 rounded-soft-inner bg-soft-inset px-3 py-2 sm:mx-4 sm:mt-4"
    >
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass
            size={16}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-soft-muted"
          />
          <Input
            ref={inputRef}
            type="search"
            role="searchbox"
            aria-label="Tìm trong bản ghi"
            placeholder="Tìm trong bản ghi"
            value={state.query}
            maxLength={MAX_QUERY_CHARS}
            autoComplete="off"
            onChange={(event) => dispatch({ type: "query", query: event.target.value })}
            onKeyDown={onKeyDown}
            className="h-9 pl-10 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <span aria-live="polite" className="shrink-0 text-small text-fg-muted">
          {resultsSummary(state)}
        </span>
        {state.status === "error" && (
          <button type="button" onClick={api.retry} className="text-small font-medium text-accent">
            Thử lại
          </button>
        )}
        <SearchButtons api={api} hasHits={hasHits} onClose={onClose} />
      </div>
      {hasHits && state.listOpen && (
        <HitList state={state} onPick={(index) => dispatch({ type: "select", index })} />
      )}
    </div>
  );
}

interface SearchButtonsProps {
  api: TranscriptSearchApi;
  hasHits: boolean;
  onClose: () => void;
}

function SearchButtons({ api, hasHits, onClose }: SearchButtonsProps) {
  const { state, dispatch } = api;
  return (
    <>
      <IconButton
        label="Kết quả trước (Shift+Enter)"
        icon={<CaretUp size={16} />}
        disabled={!hasHits}
        onClick={() => dispatch({ type: "step", delta: -1 })}
      />
      <IconButton
        label="Kết quả sau (Enter)"
        icon={<CaretDown size={16} />}
        disabled={!hasHits}
        onClick={() => dispatch({ type: "step", delta: 1 })}
      />
      <IconButton
        label={state.listOpen ? "Ẩn danh sách kết quả" : "Hiện danh sách kết quả"}
        icon={<List size={16} />}
        disabled={!hasHits}
        aria-expanded={state.listOpen}
        onClick={() => dispatch({ type: "toggle-list" })}
      />
      <IconButton label="Đóng tìm kiếm (Esc)" icon={<X size={16} />} onClick={onClose} />
    </>
  );
}

function HitList({ state, onPick }: { state: SearchState; onPick: (index: number) => void }) {
  return (
    <ul
      role="listbox"
      aria-label="Kết quả tìm kiếm"
      className="mt-2 max-h-72 overflow-y-auto rounded-control border border-line bg-surface shadow-soft-pop"
    >
      {state.hits.map((hit, index) => (
        <HitItem
          key={hit.segmentId}
          hit={hit}
          active={index === state.active}
          onPick={() => onPick(index)}
        />
      ))}
    </ul>
  );
}

function HitItem({
  hit,
  active,
  onPick,
}: {
  hit: TranscriptHitDto;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <li role="option" aria-selected={active} className="border-t border-line first:border-t-0">
      <button
        type="button"
        onClick={onPick}
        className="grid w-full grid-cols-[64px_minmax(0,1fr)] gap-x-2 px-3 py-2 text-left text-small hover:bg-surface-2 aria-[current=true]:bg-surface-2"
        aria-current={active}
      >
        <span className="font-mono text-meta text-fg-muted">{formatClock(hit.startMs)}</span>
        <span className="line-clamp-2 text-fg">
          <Snippet snippet={hit.snippet} />
        </span>
      </button>
    </li>
  );
}
