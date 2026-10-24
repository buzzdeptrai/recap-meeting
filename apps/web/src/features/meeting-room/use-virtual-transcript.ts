"use client";

import { useMemo, useRef, useState } from "react";
import type { Density } from "./density";
import type { RoomWindow } from "./paging";
import type { RoomState } from "./state";
import type { ViewMode } from "./segment-row";
import type { TranscriptPager } from "./use-transcript-pager";
import {
  openingOffset,
  useFollowState,
  useRowVirtualizer,
  useScrollerWidth,
  useScrollHandlers,
  useScrollToRow,
  type AnchorBlock,
} from "./use-virtual-helpers";
import { type EstimateContext, type ScrollAnchor, type VirtualRow } from "./virtual-rows";

import { useListEffects } from "./use-list-effects";

export { useAnchorBlock, type AnchorBlock, type ScrollOptions } from "./use-virtual-helpers";

export interface VirtualTranscriptInput {
  rows: VirtualRow[];
  view: ViewMode;
  density: Density;
  translations: RoomState["translations"];
  window: RoomWindow;
  pager: TranscriptPager;
  /** Open at the newest line and keep following it (live meeting). */
  initialFollow: boolean;
  /** Row to open on (deep link); its position is estimated for the server render. */
  initialIndex: number | null;
  /** Changes whenever the tail content changes (new row, interim text). */
  contentVersion: string;
  /** Anchoring is paused while a jump replaces the window (it must not fight the jump). */
  anchorBlock: AnchorBlock;
}

/** Virtualizer + follow-the-latest + page prefetch + scroll anchoring for the transcript list. */
export function useVirtualTranscript(input: VirtualTranscriptInput) {
  const { rows, view, density, translations, window, pager, contentVersion, anchorBlock } = input;
  const scroller = useRef<HTMLDivElement>(null);
  const width = useScrollerWidth(scroller);
  const estimate = useMemo<EstimateContext>(
    () => ({ view, density, width, translations }),
    [view, density, width, translations],
  );
  const [initialOffset] = useState(() => openingOffset(rows, input, estimate));
  const follow = useFollowState(scroller, input.initialFollow);
  const { following, nearBottom, followingRef, stickToEnd } = follow;
  const anchorRef = useRef<ScrollAnchor | null>(null);
  const virtualizer = useRowVirtualizer({
    rows,
    estimate,
    initialOffset,
    scroller,
    onChange: (isScrolling) => {
      if (followingRef.current && !isScrolling) stickToEnd();
      follow.syncBottom();
    },
  });

  const handlers = useScrollHandlers({ scroller, virtualizer, anchorRef, window, follow });

  useListEffects({
    rows,
    view,
    density,
    width,
    window,
    pager,
    virtualizer,
    scroller,
    anchorRef,
    anchorBlock,
    follow,
    contentVersion,
    captureAnchor: handlers.captureAnchor,
  });

  return {
    scroller,
    virtualizer,
    items: virtualizer.getVirtualItems(),
    following,
    nearBottom,
    onScroll: handlers.onScroll,
    scrollToRow: useScrollToRow(virtualizer, scroller),
    resumeFollowing: follow.resumeFollowing,
    stickToEnd,
  };
}
