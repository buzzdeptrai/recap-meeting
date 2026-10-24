"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Mark } from "@recap/core";
import type { MarkTarget } from "./marks";
import { isAtHead, isAtTail, type RoomWindow } from "./paging";
import type { TranscriptPager } from "./use-transcript-pager";
import type { AnchorBlock, ScrollOptions } from "./use-virtual-transcript";
import { conclusionRowKey, indexOfKey, topicRowKey, type VirtualRow } from "./virtual-rows";

/** What the transcript can scroll to, wherever it is in the meeting. */
export type JumpRequest =
  | { kind: "segment"; id: string; seq: number; atMs: number; highlight?: boolean }
  | { kind: "topic"; markId: string; atMs: number }
  | { kind: "conclusion"; markId: string; segmentId: string; seq: number; atMs: number }
  | { kind: "edge"; edge: "start" | "end" };

export const topicRequest = (mark: Mark): JumpRequest => ({
  kind: "topic",
  markId: mark.id,
  atMs: mark.atMs,
});

/** Lands on the transcript at `atMs` (no marker of its own, e.g. a minutes suggestion). */
export const timeRequest = (atMs: number): JumpRequest => ({
  kind: "topic",
  markId: "minutes-suggestion",
  atMs,
});

/** Lands on the conclusion divider; its anchor segment is the fallback (and gets the highlight). */
export const conclusionRequest = (mark: Mark, target: MarkTarget): JumpRequest => ({
  kind: "conclusion",
  markId: mark.id,
  segmentId: target.id,
  seq: target.seq,
  atMs: target.startMs,
});

/** Row to scroll to for `request` in the currently loaded rows, or -1 when it is not loaded. */
export function resolveJumpIndex(
  request: JumpRequest,
  rows: VirtualRow[],
  window: RoomWindow,
): number {
  if (request.kind === "segment") return indexOfKey(rows, request.id);
  if (request.kind === "edge") {
    if (request.edge === "start") return isAtHead(window) ? 0 : -1;
    return isAtTail(window) ? rows.length - 1 : -1;
  }
  if (request.kind === "conclusion") {
    const divider = indexOfKey(rows, conclusionRowKey(request.markId));
    return divider >= 0 ? divider : indexOfKey(rows, request.segmentId);
  }
  const divider = indexOfKey(rows, topicRowKey(request.markId));
  if (divider >= 0) return divider;
  // No divider in view: land on the first segment at or after the marker, if it is in the run.
  const segments = rows.flatMap((row) => (row.type === "segment" ? [row.segment] : []));
  const first = segments[0];
  const last = segments.at(-1);
  if (!first || !last) return -1;
  const covered =
    (request.atMs >= first.startMs || isAtHead(window)) &&
    (request.atMs <= last.startMs || isAtTail(window));
  if (!covered) return -1;
  const index = rows.findIndex(
    (row) => row.type === "segment" && row.segment.startMs >= request.atMs,
  );
  return index >= 0 ? index : rows.length - 1;
}

interface JumpInput {
  rows: VirtualRow[];
  window: RoomWindow;
  pager: TranscriptPager;
  scrollToRow: (index: number, options?: ScrollOptions) => void;
  resumeFollowing: () => void;
  anchorBlock: AnchorBlock;
  initialHighlight: string | null;
}

/** Scrolls to a request, loading the page that holds it first when it is not in the window. */
export function useTranscriptJump(input: JumpInput) {
  const { rows, window, pager, scrollToRow, resumeFollowing, anchorBlock } = input;
  const [highlightId, setHighlightId] = useState<string | null>(input.initialHighlight);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<JumpRequest | null>(null);
  /** Bumped when the page for the pending request has been applied (then it is resolved or dropped). */
  const loadedFor = useRef<JumpRequest | null>(null);
  const [loadedTick, setLoadedTick] = useState(0);

  const land = useCallback(
    (request: JumpRequest, index: number, smooth: boolean) => {
      if (request.kind === "segment" && request.highlight) setHighlightId(request.id);
      if (request.kind === "conclusion") setHighlightId(request.segmentId);
      landOn({ request, index, smooth, scrollToRow, resumeFollowing });
    },
    [scrollToRow, resumeFollowing],
  );
  const load = useCallback((request: JumpRequest) => loadFor(pager, request), [pager]);

  const jump = useCallback(
    (request: JumpRequest) => {
      setError(null);
      const index = resolveJumpIndex(request, rows, window);
      if (index >= 0) return land(request, index, true);
      pending.current = request;
      anchorBlock.block();
      load(request)
        .then(() => {
          loadedFor.current = request;
          setLoadedTick((tick) => tick + 1);
        })
        .catch(() => {
          pending.current = null;
          anchorBlock.release();
          setError("Không tải được đoạn này. Thử lại.");
        });
    },
    [rows, window, land, load, anchorBlock],
  );

  // After the window was replaced: scroll before paint so the wrong part never shows.
  useLayoutEffect(() => {
    const request = pending.current;
    if (!request) return;
    const index = resolveJumpIndex(request, rows, window);
    if (index >= 0) land(request, index, false);
    if (index >= 0 || loadedFor.current === request) {
      pending.current = null;
      anchorBlock.release();
    }
  }, [rows, window, loadedTick, land, anchorBlock]);

  return { jump, highlightId, setHighlightId, error };
}

interface LandInput {
  request: JumpRequest;
  index: number;
  smooth: boolean;
  scrollToRow: JumpInput["scrollToRow"];
  resumeFollowing: () => void;
}

function landOn({ request, index, smooth, scrollToRow, resumeFollowing }: LandInput) {
  if (request.kind !== "edge") return scrollToRow(index, { align: "center", smooth });
  if (request.edge === "end") resumeFollowing();
  else scrollToRow(0, { align: "start", smooth });
}

/** Fetches the page a request needs (the reducer replaces the window when it arrives). */
async function loadFor(pager: TranscriptPager, request: JumpRequest): Promise<void> {
  if (request.kind === "edge") {
    return request.edge === "start" ? pager.loadHead() : pager.loadTail();
  }
  const bySeq = request.kind === "segment" || request.kind === "conclusion";
  await pager.jumpTo(bySeq ? { seq: request.seq } : { atMs: request.atMs });
}
