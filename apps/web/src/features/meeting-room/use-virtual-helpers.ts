"use client";

import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { isAtTail, type RoomWindow } from "./paging";
import {
  estimatedStart,
  estimateRowHeight,
  NARROW_PX,
  pickAnchor,
  type EstimateContext,
  type ScrollAnchor,
  type VirtualRow,
} from "./virtual-rows";

const OVERSCAN_ROWS = 8;
/** Start loading the next page when the viewport is this many rows from the loaded edge. */
export const PREFETCH_ROWS = 60;
/** Distance from the bottom (px) still counted as "at the latest line". */
const BOTTOM_THRESHOLD_PX = 64;
export const PADDING_PX = 8;
export const SSR_VIEWPORT = { width: 900, height: 800 };
const COMPACT_WIDTH = 400;
const WIDE_WIDTH = 1000;

export type RowVirtualizer = Virtualizer<HTMLDivElement, Element>;

export interface ScrollOptions {
  align?: "start" | "center" | "end" | "auto";
  smooth?: boolean;
}

export interface AnchorBlock {
  block: () => void;
  release: () => void;
  isBlocked: () => boolean;
}

export function useAnchorBlock(): AnchorBlock {
  const blocked = useRef(false);
  return useMemo(
    () => ({
      block: () => void (blocked.current = true),
      release: () => void (blocked.current = false),
      isBlocked: () => blocked.current,
    }),
    [],
  );
}

export const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useScrollerWidth(scroller: RefObject<HTMLDivElement | null>) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setCompact(el.clientWidth < NARROW_PX));
    observer.observe(el);
    return () => observer.disconnect();
  }, [scroller]);
  return compact ? COMPACT_WIDTH : WIDE_WIDTH;
}

interface RowVirtualizerInput {
  rows: VirtualRow[];
  estimate: EstimateContext;
  initialOffset: number;
  scroller: RefObject<HTMLDivElement | null>;
  onChange: (isScrolling: boolean) => void;
}

export function useRowVirtualizer(input: RowVirtualizerInput): RowVirtualizer {
  const { rows, estimate, initialOffset, scroller, onChange } = input;
  return useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: (index) => estimateRowHeight(rows[index], estimate),
    getItemKey: (index) => rows[index]?.key ?? index,
    overscan: OVERSCAN_ROWS,
    paddingStart: PADDING_PX,
    paddingEnd: PADDING_PX,
    initialRect: SSR_VIEWPORT,
    initialOffset,
    onChange: (_instance, isScrolling) => onChange(isScrolling),
  });
}

interface HandlerInput {
  scroller: RefObject<HTMLDivElement | null>;
  virtualizer: RowVirtualizer;
  anchorRef: RefObject<ScrollAnchor | null>;
  window: RoomWindow;
  follow: ReturnType<typeof useFollowState>;
}

/** Remembers the row to hold still on prepends, and keeps "following" in step with the user. */
export function useScrollHandlers({
  scroller,
  virtualizer,
  anchorRef,
  window,
  follow,
}: HandlerInput) {
  const captureAnchor = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const items = virtualizer.getVirtualItems();
    anchorRef.current = pickAnchor(
      items.map((i) => ({ key: String(i.key), start: i.start, size: i.size })),
      el.scrollTop,
    );
  }, [scroller, virtualizer, anchorRef]);
  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    follow.setFollowing(isNearBottom(el) && isAtTail(window));
    captureAnchor();
  }, [scroller, window, captureAnchor, follow]);
  return { captureAnchor, onScroll };
}

export function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX;
}

/** "Following the newest line": sticky intent (ref for event handlers, state for the pill). */
export function useFollowState(scroller: RefObject<HTMLDivElement | null>, initial: boolean) {
  const [following, setFollowingState] = useState(initial);
  const [nearBottom, setNearBottom] = useState(initial);
  const followingRef = useRef(initial);
  const stickToEnd = useCallback(() => {
    const el = scroller.current;
    el?.scrollTo({ top: el.scrollHeight });
  }, [scroller]);
  const setFollowing = useCallback((value: boolean) => {
    followingRef.current = value;
    setFollowingState(value);
  }, []);
  const syncBottom = useCallback(() => {
    if (scroller.current) setNearBottom(isNearBottom(scroller.current));
  }, [scroller]);
  const resumeFollowing = useCallback(() => {
    setFollowing(true);
    stickToEnd();
  }, [setFollowing, stickToEnd]);
  return useMemo(
    () => ({
      following,
      nearBottom,
      followingRef,
      stickToEnd,
      setFollowing,
      syncBottom,
      resumeFollowing,
    }),
    [following, nearBottom, stickToEnd, setFollowing, syncBottom, resumeFollowing],
  );
}

const SETTLE_FRAMES = 6;

/**
 * Scrolls a row into view. Rows are measured while scrolling, so after the library's own jump the
 * target is nudged to the exact centre for a few frames (the estimate alone lands off by ~100px).
 */
export function useScrollToRow(
  virtualizer: RowVirtualizer,
  scroller: RefObject<HTMLDivElement | null>,
) {
  return useCallback(
    (index: number, options: ScrollOptions = {}) => {
      const align = options.align ?? "center";
      const smooth = options.smooth && !prefersReducedMotion();
      virtualizer.scrollToIndex(index, { align, behavior: smooth ? "smooth" : "auto" });
      if (align === "center" && !smooth) settleOnCentre(scroller, index, SETTLE_FRAMES);
    },
    [virtualizer, scroller],
  );
}

function settleOnCentre(
  scroller: RefObject<HTMLDivElement | null>,
  index: number,
  framesLeft: number,
) {
  requestAnimationFrame(() => {
    const el = scroller.current;
    const row = el?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (el && row) {
      const box = el.getBoundingClientRect();
      const rowBox = row.getBoundingClientRect();
      const delta = (rowBox.top + rowBox.bottom) / 2 - (box.top + box.bottom) / 2;
      if (Math.abs(delta) > 2) el.scrollBy({ top: delta });
    }
    if (framesLeft > 1) settleOnCentre(scroller, index, framesLeft - 1);
  });
}

/** Scroll offset the list opens at: the newest line, a deep-linked row, or the top. */
export function openingOffset(
  rows: VirtualRow[],
  open: { initialFollow: boolean; initialIndex: number | null },
  estimate: EstimateContext,
): number {
  if (open.initialFollow) {
    return Math.max(0, estimatedStart(rows, rows.length, estimate) - SSR_VIEWPORT.height);
  }
  if (open.initialIndex === null) return 0;
  return Math.max(0, estimatedStart(rows, open.initialIndex, estimate) - SSR_VIEWPORT.height / 2);
}
