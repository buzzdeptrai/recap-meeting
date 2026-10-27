"use client";

import {
  useImperativeHandle,
  useMemo,
  useRef,
  type Dispatch,
  type ReactNode,
  type Ref,
} from "react";
import type { TargetLang } from "@recap/core";
import type { Density } from "./density";
import { isAtTail } from "./paging";
import type { ViewMode } from "./segment-row";
import { SelectionNoteAction } from "./selection-note-action";
import type { MeetingNotesApi } from "./use-meeting-notes";
import type { RoomAction, RoomState } from "./state";
import { LatestPill, VirtualRowView, type RowViewContext } from "./transcript-parts";
import {
  useFollowOnRecord,
  useListKeys,
  useOpenOnFocus,
  useOpeningFocus,
  useSettledSeq,
} from "./use-transcript-helpers";
import { useTranscriptJump, type JumpRequest } from "./use-transcript-jump";
import { useTranscriptPager } from "./use-transcript-pager";
import { useAnchorBlock, useVirtualTranscript } from "./use-virtual-transcript";
import { buildVirtualRows, indexOfKey, type VirtualRow } from "./virtual-rows";

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
  density: Density;
  /** Language the meeting translates into. */
  targetLang: TargetLang;
  /** Shown instead of the list while there is nothing to read yet. */
  empty: ReactNode;
  ended: boolean;
  recording: boolean;
  /** Offset (ms) from a minutes timestamp link: highlighted and scrolled to on open. */
  focusMs?: number | null;
  /** Folded words of the active in-transcript search, marked inside rows. */
  searchTerms?: readonly string[];
  /** Hand notes: when given, selecting transcript text offers "Thêm vào ghi chú". */
  notes?: MeetingNotesApi;
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
  const { room, dispatch, view, density, ended, recording, focusMs = null, searchTerms } = props;
  const rows = useRows(room, ended, recording);
  const pager = useTranscriptPager(props.meetingId, room.window, dispatch);
  const anchorBlock = useAnchorBlock();
  const focusId = useOpeningFocus(room, focusMs, ended);
  const list = useVirtualTranscript({
    rows,
    view,
    density,
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
    density,
    targetLang: props.targetLang,
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
  const frame = useRef<HTMLDivElement>(null);
  const hasContent = room.segments.length > 0 || room.interim[0] || room.interim[1];
  const onKeyDown = useListKeys(rows, list, jumper.jump);
  const pill = !list.following && hasContent && (!list.nearBottom || !isAtTail(room.window));

  return (
    <div ref={frame} className="relative min-h-0 flex-1">
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
      {props.notes && (
        <SelectionNoteAction scrollerRef={list.scroller} frameRef={frame} notes={props.notes} />
      )}
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
