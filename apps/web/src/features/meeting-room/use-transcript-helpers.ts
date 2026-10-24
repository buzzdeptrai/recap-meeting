"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { nearestSegmentId } from "./marks";
import { isAtTail } from "./paging";
import type { RoomState } from "./state";
import type { JumpRequest } from "./use-transcript-jump";
import type { useVirtualTranscript } from "./use-virtual-transcript";
import { indexOfKey, neighbourSegmentIndex, type VirtualRow } from "./virtual-rows";

/** Segment nearest to `focusMs` in the opening page (ended room only). */
export function useOpeningFocus(room: RoomState, focusMs: number | null, ended: boolean) {
  const [initial] = useState(() =>
    ended && focusMs !== null ? nearestSegmentId(room.segments, focusMs) : null,
  );
  return initial;
}

/** Exact centring on the deep-linked row once rows are measured (the server render only estimated). */
export function useOpenOnFocus(
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
export function useFollowOnRecord(
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
export function useSettledSeq(rows: VirtualRow[]): number {
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
export function useListKeys(
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
