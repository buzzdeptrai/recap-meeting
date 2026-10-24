"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { isAtTail, type RoomWindow } from "./paging";
import type { ViewMode } from "./segment-row";
import type { TranscriptPager } from "./use-transcript-pager";
import {
  PREFETCH_ROWS,
  type AnchorBlock,
  type RowVirtualizer,
  type useFollowState,
} from "./use-virtual-helpers";
import { anchoredScrollTop, indexOfKey, type ScrollAnchor, type VirtualRow } from "./virtual-rows";

export function useStickWhileFollowing(
  followingRef: RefObject<boolean>,
  following: boolean,
  contentVersion: string,
  window: RoomWindow,
  stickToEnd: () => void,
) {
  useLayoutEffect(() => {
    if (followingRef.current && isAtTail(window)) stickToEnd();
  }, [followingRef, following, contentVersion, window, stickToEnd]);
}

/** Cached row heights are stale after the view mode (translation shown or not) or width changes. */
export function useRemeasureOnLayoutChange(
  virtualizer: RowVirtualizer,
  view: ViewMode,
  width: number,
) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    virtualizer.measure();
  }, [virtualizer, view, width]);
}

/** When rows appear above (older page, or the top loader going away) keep the viewport still. */
export function usePrependAnchoring(
  rows: VirtualRow[],
  virtualizer: RowVirtualizer,
  scroller: RefObject<HTMLDivElement | null>,
  anchorRef: RefObject<ScrollAnchor | null>,
  anchorBlock: AnchorBlock,
) {
  const firstKey = rows.find((row) => row.type !== "edge")?.key;
  const previous = useRef(firstKey);
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = firstKey;
    const anchor = anchorRef.current;
    const el = scroller.current;
    if (!anchor || !el || before === undefined || before === firstKey || anchorBlock.isBlocked())
      return;
    const index = indexOfKey(rows, anchor.key);
    const start = index < 0 ? undefined : virtualizer.measurementsCache[index]?.start;
    if (start === undefined) return;
    const target = anchoredScrollTop(anchor, start);
    if (Math.abs(target - el.scrollTop) > 1) virtualizer.scrollToOffset(target);
  }, [firstKey, rows, virtualizer, scroller, anchorRef, anchorBlock]);
}

interface PrefetchInput {
  firstIndex: number;
  lastIndex: number;
  rows: VirtualRow[];
  window: RoomWindow;
  pager: TranscriptPager;
  captureAnchor: () => void;
}

/** Loads the neighbouring page before the viewport reaches the edge of the loaded run. */
export function usePrefetch({
  firstIndex,
  lastIndex,
  rows,
  window,
  pager,
  captureAnchor,
}: PrefetchInput) {
  const start = firstIndex;
  const end = lastIndex;
  const { loadPrev, loadNext } = pager;
  useEffect(() => {
    if (window.prevCursor !== null && pager.prev === "idle" && start <= PREFETCH_ROWS) {
      captureAnchor();
      loadPrev();
    }
    if (
      window.nextCursor !== null &&
      pager.next === "idle" &&
      end >= rows.length - 1 - PREFETCH_ROWS
    ) {
      loadNext();
    }
  }, [start, end, rows.length, window, pager.prev, pager.next, loadPrev, loadNext, captureAnchor]);
}

interface ListEffectsInput {
  rows: VirtualRow[];
  view: ViewMode;
  width: number;
  window: RoomWindow;
  pager: TranscriptPager;
  virtualizer: RowVirtualizer;
  scroller: RefObject<HTMLDivElement | null>;
  anchorRef: RefObject<ScrollAnchor | null>;
  anchorBlock: AnchorBlock;
  follow: ReturnType<typeof useFollowState>;
  contentVersion: string;
  captureAnchor: () => void;
}

/** Side effects of the list: stick to the newest row, re-measure, hold position, prefetch. */
export function useListEffects(input: ListEffectsInput) {
  const { rows, view, width, window, pager, virtualizer, scroller, follow } = input;
  const { followingRef, following, stickToEnd } = follow;
  const items = virtualizer.getVirtualItems();
  useStickWhileFollowing(followingRef, following, input.contentVersion, window, stickToEnd);
  useRemeasureOnLayoutChange(virtualizer, view, width);
  usePrependAnchoring(rows, virtualizer, scroller, input.anchorRef, input.anchorBlock);
  usePrefetch({
    firstIndex: items[0]?.index ?? 0,
    lastIndex: items.at(-1)?.index ?? 0,
    rows,
    window,
    pager,
    captureAnchor: input.captureAnchor,
  });
}
