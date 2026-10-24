"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { nearestSegmentId } from "./marks";
import { isAtTail } from "./paging";
import type { ViewMode } from "./segment-row";
import type { RoomAction, RoomState } from "./state";
import { LatestPill, VirtualRowView, type RowViewContext } from "./transcript-parts";
import { useTranscriptJump, type JumpRequest } from "./use-transcript-jump";
import { useTranscriptPager } from "./use-transcript-pager";
import { useAnchorBlock, useVirtualTranscript } from "./use-virtual-transcript";
import {
  buildVirtualRows,
  indexOfKey,
  neighbourSegmentIndex,
  type VirtualRow,
} from "./virtual-rows";

export interface TranscriptHandle {
  jump: (request: JumpRequest) => void;
  clearHighlight: () => void;
  focus: () => void;
}

interface TranscriptProps {
  meetingId: string;
  room: RoomState;
  dispatch: Dispatch<RoomAction>;
  view: ViewMode;
  /** Shown instead of the list while there is nothing to read yet. */
  empty: ReactNode;
  ended: boolean;
  recording: boolean;
  /** Offset (ms) from a minutes timestamp link: highlighted and scrolled to on open. */
  focusMs?: number | null;
  /** Folded words of the active in-transcript search, marked inside rows. */
  searchTerms?: readonly string[];
  ref?: Ref<TranscriptHandle>;
}

const interimVersion = (room: RoomState) =>
  `${room.interim[0]?.text ?? ""}|${room.interim[1]?.text ?? ""}`;

function useRows(room: RoomState, ended: boolean, recording: boolean) {
  const edges = useMemo(
    () => ({ hasPrev: room.window.prevCursor !== null, hasNext: room.window.nextCursor !== null }),
    [room.window],
  );
  return useMemo(
    () =>
      buildVirtualRows({
        segments: room.segments,
        marks: room.marks,
        edges,
        interim: room.interim,
        showInterim: !ended || recording,
      }),
    [room.segments, room.marks, room.interim, edges, ended, recording],
  );
}

/** Everything the transcript needs: rows, pager, virtualizer, jumps, and the row context. */
function useTranscriptModel(props: TranscriptProps) {
  const { room, dispatch, view, ended, recording, focusMs = null, searchTerms } = props;
  const rows = useRows(room, ended, recording);
  const pager = useTranscriptPager(props.meetingId, room.window, dispatch);
  const anchorBlock = useAnchorBlock();
  const focusId = useOpeningFocus(room, focusMs, ended);
  const list = useVirtualTranscript({
    rows,
    view,
    translations: room.translations,
    window: room.window,
    pager,
    initialFollow: !ended,
    initialIndex: focusId === null ? null : indexOfKey(rows, focusId),
    contentVersion: `${rows.length}:${interimVersion(room)}`,
    anchorBlock,
  });
  const jumper = useTranscriptJump({
    rows,
    window: room.window,
    pager,
    scrollToRow: list.scrollToRow,
    resumeFollowing: list.resumeFollowing,
    anchorBlock,
    initialHighlight: focusId,
  });
  useOpenOnFocus(focusId, rows, list.scrollToRow);
  useFollowOnRecord(recording, room, jumper.jump, list.resumeFollowing);
  useImperativeHandle(props.ref, () => ({
    jump: jumper.jump,
    clearHighlight: () => jumper.setHighlightId(null),
    focus: () => list.scroller.current?.focus({ preventScroll: true }),
  }));
  const settledSeq = useSettledSeq(rows);
  const ctx: RowViewContext = {
    room,
    view,
    marks: room.marks,
    highlightId: jumper.highlightId,
    terms: searchTerms,
    liveFromSeq: room.liveFromSeq,
    settledSeq,
    edge: { top: pager.prev, bottom: pager.next },
    onRetryEdge: (side) => (side === "top" ? pager.loadPrev() : pager.loadNext()),
  };
  return { rows, pager, list, jumper, ctx };
}

/* eslint-disable react-hooks/refs -- the scroller ref is only attached to the element, never read in render */
export function Transcript(props: TranscriptProps) {
  const { room, empty, ended, recording } = props;
  const { rows, pager, list, jumper, ctx } = useTranscriptModel(props);
  const hasContent = room.segments.length > 0 || room.interim[0] || room.interim[1];
  const onKeyDown = useListKeys(rows, list, jumper.jump);
  const pill = !list.following && hasContent && (!list.nearBottom || !isAtTail(room.window));

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={list.scroller}
        onScroll={list.onScroll}
        onKeyDown={onKeyDown}
        role="log"
        tabIndex={0}
        aria-label={`Bản ghi cuộc họp, ${room.stats.segments} đoạn`}
        aria-live="off"
        aria-busy={pager.prev === "loading" || pager.next === "loading"}
        className="soft-focus h-full overflow-y-auto [overflow-anchor:none]"
      >
        {hasContent ? (
          <VirtualList rows={rows} list={list} ctx={ctx} total={room.stats.segments} />
        ) : (
          empty
        )}
      </div>
      {jumper.error && (
        <p role="alert" className="absolute inset-x-0 top-2 text-center text-small text-err">
          {jumper.error}
        </p>
      )}
      {pill && (
        <LatestPill
          label={ended && !recording ? "Về cuối" : "Về dòng mới nhất"}
          onClick={() => jumper.jump({ kind: "edge", edge: "end" })}
        />
      )}
    </div>
  );
}

/* eslint-enable react-hooks/refs */

interface VirtualListProps {
  rows: VirtualRow[];
  list: ReturnType<typeof useVirtualTranscript>;
  ctx: RowViewContext;
  total: number;
}

function VirtualList({ rows, list, ctx, total }: VirtualListProps) {
  return (
    <div
      role="list"
      style={{ height: list.virtualizer.getTotalSize(), position: "relative", width: "100%" }}
    >
      {list.items.map((item) => {
        const row = rows[item.index];
        if (!row) return null;
        return (
          <div
            key={item.key}
            data-index={item.index}
            ref={list.virtualizer.measureElement}
            role="listitem"
            aria-posinset={row.type === "segment" ? row.segment.seq + 1 : undefined}
            aria-setsize={row.type === "segment" ? total : undefined}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${item.start}px)`,
            }}
          >
            <VirtualRowView row={row} ctx={ctx} />
          </div>
        );
      })}
    </div>
  );
}

/** Segment nearest to `focusMs` in the opening page (ended room only). */
function useOpeningFocus(room: RoomState, focusMs: number | null, ended: boolean) {
  const [initial] = useState(() =>
    ended && focusMs !== null ? nearestSegmentId(room.segments, focusMs) : null,
  );
  return initial;
}

/** Exact centring on the deep-linked row once rows are measured (the server render only estimated). */
function useOpenOnFocus(
  focusId: string | null,
  rows: VirtualRow[],
  scrollToRow: (index: number, options?: { align?: "center" }) => void,
) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || focusId === null) return;
    const index = indexOfKey(rows, focusId);
    if (index < 0) return;
    done.current = true;
    scrollToRow(index, { align: "center" });
  }, [focusId, rows, scrollToRow]);
}

/** Starting to record: show the live tail and follow it (loading it when we are elsewhere). */
function useFollowOnRecord(
  recording: boolean,
  room: RoomState,
  jump: (request: JumpRequest) => void,
  resumeFollowing: () => void,
) {
  const wasRecording = useRef(recording);
  useEffect(() => {
    const started = recording && !wasRecording.current;
    wasRecording.current = recording;
    if (!started) return;
    if (isAtTail(room.window)) resumeFollowing();
    else jump({ kind: "edge", edge: "end" });
  }, [recording, room.window, jump, resumeFollowing]);
}

const SETTLE_MS = 400;

/**
 * Highest live seq whose fade-in has had time to play. Rows at or below it never animate again
 * (e.g. when scrolled out and back in); newer live rows animate once.
 */
function useSettledSeq(rows: VirtualRow[]): number {
  const [settled, setSettled] = useState(-1);
  const last = rows.findLast((row) => row.type === "segment");
  const lastSeq = last?.type === "segment" ? last.segment.seq : -1;
  useEffect(() => {
    const timer = setTimeout(() => setSettled(lastSeq), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [lastSeq]);
  return settled;
}

/** Home / End jump to the very start / end of the meeting; arrows move between rows. */
function useListKeys(
  rows: VirtualRow[],
  list: ReturnType<typeof useVirtualTranscript>,
  jump: (request: JumpRequest) => void,
) {
  return useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        jump({ kind: "edge", edge: event.key === "Home" ? "start" : "end" });
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const current = rowIndexOf(event.target);
      if (current === null) return;
      const target = neighbourSegmentIndex(rows, current, event.key === "ArrowDown" ? 1 : -1);
      if (target < 0) return;
      event.preventDefault();
      list.scrollToRow(target, { align: "auto" });
      requestAnimationFrame(() => focusRow(event.currentTarget, target));
    },
    [rows, list, jump],
  );
}

function rowIndexOf(target: EventTarget): number | null {
  if (!(target instanceof HTMLElement) || !target.hasAttribute("data-seg-row")) return null;
  const index = target.closest("[data-index]")?.getAttribute("data-index");
  return index === null || index === undefined ? null : Number(index);
}

function focusRow(scroller: HTMLElement, index: number) {
  scroller.querySelector<HTMLElement>(`[data-index="${index}"] [data-seg-row]`)?.focus({
    preventScroll: true,
  });
}
