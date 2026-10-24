"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { RoomState } from "./state";
import type { TranscriptHandle } from "./transcript";
import { useTranscriptSearch } from "./use-transcript-search";

/** Browser find cannot see rows that are not rendered, so Ctrl/Cmd+F opens ours inside the room. */
export function isFindShortcut(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">,
) {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "f";
}

/** True when keyboard focus is somewhere in the room (or nowhere: the page body). */
export function focusIsInRoom(root: HTMLElement | null, active: Element | null): boolean {
  if (!root || !active) return false;
  return active === document.body || root.contains(active);
}

interface RoomSearchOptions {
  meetingId: string;
  /** Its segment count changing refreshes a live search. */
  room: RoomState;
  root: RefObject<HTMLElement | null>;
  transcript: RefObject<TranscriptHandle | null>;
}

export function useRoomSearch({ meetingId, room, root, transcript }: RoomSearchOptions) {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const search = useTranscriptSearch(meetingId, room.stats.segments);
  const { dispatch } = search;

  const openSearch = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    dispatch({ type: "reset" });
    transcript.current?.clearHighlight();
    transcript.current?.focus();
  }, [dispatch, transcript]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isFindShortcut(event) && focusIsInRoom(root.current, document.activeElement)) {
        event.preventDefault();
        openSearch();
      } else if (
        event.key === "Escape" &&
        open &&
        focusIsInRoom(root.current, document.activeElement)
      ) {
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, openSearch, close, root]);

  const { current } = search;
  const { nonce } = search.state;
  useEffect(() => {
    if (!open || !current) return;
    transcript.current?.jump({
      kind: "segment",
      id: current.segmentId,
      seq: current.seq,
      atMs: current.startMs,
      highlight: true,
    });
    // Only a new request (nonce) scrolls; a refreshed hit list must not pull the view back.
  }, [nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const terms = open && search.state.status === "ready" ? search.state.terms : undefined;
  return { open, openSearch, close, search, input, terms };
}
