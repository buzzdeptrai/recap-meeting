"use client";

import { useCallback, useRef, useState, type Dispatch } from "react";
import type { SegmentsPageDto } from "@/lib/api-types";
import { fetchSegmentsPage, locateSegment, type LocateTarget } from "@/lib/api-transcript";
import type { PageDirection, RoomWindow } from "./paging";
import type { RoomAction } from "./state";

/** Segments per request (the server clamps to 500). */
export const PAGE_SIZE = 200;

export type EdgeState = "idle" | "loading" | "error";

export interface TranscriptPager {
  /** State of the page being fetched above / below the loaded run. */
  prev: EdgeState;
  next: EdgeState;
  loadPrev: () => void;
  loadNext: () => void;
  /** Replaces the window with the page around a time / seq; resolves to the target segment id. */
  jumpTo: (target: LocateTarget) => Promise<string | null>;
  /** Replaces the window with the first / last page of the meeting. */
  loadHead: () => Promise<void>;
  loadTail: () => Promise<void>;
}

/**
 * Fetches transcript pages for an ended meeting. Requests are de-duplicated per (direction,
 * cursor); a response is applied by the reducer only if the window still waits for that cursor.
 */
export function useTranscriptPager(
  meetingId: string,
  window: RoomWindow,
  dispatch: Dispatch<RoomAction>,
): TranscriptPager {
  const inFlight = useRef(new Map<string, Promise<void>>());
  const [prev, setPrev] = useState<EdgeState>("idle");
  const [next, setNext] = useState<EdgeState>("idle");

  const loadEdge = useCallback(
    (dir: PageDirection, cursor: number | null) => {
      if (cursor === null) return;
      const key = `${dir}:${cursor}`;
      if (inFlight.current.has(key)) return;
      const setState = dir === "forward" ? setNext : setPrev;
      setState("loading");
      const request = fetchSegmentsPage(meetingId, { dir, from: cursor, limit: PAGE_SIZE })
        .then((page: SegmentsPageDto) => {
          dispatch({ type: "page-loaded", dir, from: cursor, page });
          setState("idle");
        })
        .catch(() => setState("error"))
        .finally(() => inFlight.current.delete(key));
      inFlight.current.set(key, request);
    },
    [meetingId, dispatch],
  );

  const loadPrev = useCallback(() => loadEdge("backward", window.prevCursor), [loadEdge, window]);
  const loadNext = useCallback(() => loadEdge("forward", window.nextCursor), [loadEdge, window]);

  const resetEdges = useCallback(() => {
    setPrev("idle");
    setNext("idle");
  }, []);
  const { replaceWith, jumpTo } = useReplace(meetingId, dispatch, resetEdges);

  return {
    prev,
    next,
    loadPrev,
    loadNext,
    jumpTo,
    loadHead: useCallback(() => replaceWith({ dir: "forward" }), [replaceWith]),
    loadTail: useCallback(() => replaceWith({ dir: "backward" }), [replaceWith]),
  };
}

/** Replacing the window: first / last page, or the page around a located segment. */
function useReplace(meetingId: string, dispatch: Dispatch<RoomAction>, onDone: () => void) {
  const replaceWith = useCallback(
    async (query: Parameters<typeof fetchSegmentsPage>[1]) => {
      const page = await fetchSegmentsPage(meetingId, { ...query, limit: PAGE_SIZE });
      dispatch({ type: "window-replaced", page });
      onDone();
    },
    [meetingId, dispatch, onDone],
  );
  const jumpTo = useCallback(
    async (target: LocateTarget) => {
      const located = await locateSegment(meetingId, target, PAGE_SIZE);
      await replaceWith({ dir: "forward", from: located.from });
      return located.segmentId;
    },
    [meetingId, replaceWith],
  );
  return { replaceWith, jumpTo };
}
