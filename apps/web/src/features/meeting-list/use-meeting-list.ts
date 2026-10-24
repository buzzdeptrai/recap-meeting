"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { fetchMeetingList } from "@/lib/api";
import type { MeetingListCounts, MeetingListDto, MeetingListItemDto } from "@/lib/api-types";
import {
  PAGE_SIZE,
  clearedState,
  listHref,
  sameState,
  type ListState,
  type SortState,
} from "@/lib/list-query";

const DEBOUNCE_MS = 250;
/** Skeleton rows only appear when a request is still running after this long (no flash on fast ones). */
const SKELETON_DELAY_MS = 150;

export interface ListData {
  items: MeetingListItemDto[];
  total: number;
  counts: MeetingListCounts;
  totals: MeetingListDto["totals"];
}

const toData = (dto: MeetingListDto): ListData => ({
  items: dto.meetings,
  total: dto.total,
  counts: dto.counts,
  totals: dto.totals,
});

const messageOf = (err: unknown) =>
  err instanceof Error ? err.message : "Không thể tải danh sách cuộc họp.";

interface Fetching {
  state: ListState;
  retryCount: number;
  settledRef: RefObject<ListState>;
  lastRetryRef: RefObject<number>;
  setData: Dispatch<SetStateAction<ListData>>;
  setPending: (pending: boolean) => void;
  setSlow: (slow: boolean) => void;
  setError: (error: string | null) => void;
}

/** Re-queries whenever the state changes (search text debounced) or a retry is requested. */
function useRefetch(f: Fetching) {
  const { state, retryCount, settledRef, lastRetryRef } = f;
  const { setData, setPending, setSlow, setError } = f;
  useEffect(() => {
    const retrying = retryCount !== lastRetryRef.current;
    if (sameState(state, settledRef.current) && !retrying) {
      setPending(false);
      return;
    }
    lastRetryRef.current = retryCount;
    const controller = new AbortController();
    const delay = state.q.trim() !== settledRef.current.q.trim() ? DEBOUNCE_MS : 0;
    setPending(true);
    setError(null);
    const skeleton = setTimeout(() => setSlow(true), SKELETON_DELAY_MS + delay);
    const timer = setTimeout(async () => {
      try {
        const result = await fetchMeetingList({ state, limit: PAGE_SIZE }, controller.signal);
        settledRef.current = state;
        window.history.replaceState(null, "", listHref(state));
        setData(toData(result));
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(messageOf(err));
      }
      setPending(false);
      setSlow(false);
    }, delay);
    return () => {
      clearTimeout(timer);
      clearTimeout(skeleton);
      controller.abort();
      setSlow(false);
    };
  }, [state, retryCount, settledRef, lastRetryRef, setData, setPending, setSlow, setError]);
}

/** "Tải thêm": appends the next page of the settled query without touching scroll position. */
function useLoadMore(
  settled: RefObject<ListState>,
  offset: number,
  setData: Dispatch<SetStateAction<ListData>>,
  setError: (error: string | null) => void,
) {
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const result = await fetchMeetingList({ state: settled.current, limit: PAGE_SIZE, offset });
      setData((current) => ({ ...toData(result), items: [...current.items, ...result.meetings] }));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoadingMore(false);
    }
  }, [settled, offset, setData, setError]);
  return { loadMore, loadingMore };
}

/**
 * Meeting list state: filters live in `ListState`, mirrored into the URL with `replaceState`
 * (linkable without a server round-trip). Typing in the search box is debounced; every other
 * control applies at once. `initial` is what the server rendered for `initialState`.
 */
export function useMeetingList(initial: MeetingListDto, initialState: ListState) {
  const [state, setState] = useState<ListState>(initialState);
  const [data, setData] = useState<ListData>(() => toData(initial));
  const [{ pending, slow }, setFlags] = useState({ pending: false, slow: false });
  const [error, setError] = useState<string | null>(null);
  const setPending = useCallback((v: boolean) => setFlags((f) => ({ ...f, pending: v })), []);
  const setSlow = useCallback((v: boolean) => setFlags((f) => ({ ...f, slow: v })), []);
  const [retryCount, setRetryCount] = useState(0);
  const settled = useRef<ListState>(initialState);
  const lastRetry = useRef(0);

  useRefetch({
    state,
    retryCount,
    settledRef: settled,
    lastRetryRef: lastRetry,
    setData,
    setPending,
    setSlow,
    setError,
  });

  const { loadMore, loadingMore } = useLoadMore(settled, data.items.length, setData, setError);

  const patch = useCallback(
    (change: Partial<ListState>) => setState((s) => ({ ...s, ...change })),
    [],
  );

  return {
    state,
    ...data,
    /** A new query is running long enough to replace the list with skeleton rows. */
    loading: pending && slow,
    busy: pending,
    loadingMore,
    error,
    patch,
    setSort: (sort: SortState) => patch({ sort }),
    replace: (next: ListState) => setState(next),
    clear: () => setState((s) => clearedState(s)),
    retry: () => setRetryCount((n) => n + 1),
    loadMore,
  };
}

export type MeetingListController = ReturnType<typeof useMeetingList>;
