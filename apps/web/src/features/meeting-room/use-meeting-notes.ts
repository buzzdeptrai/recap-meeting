"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createNoteRest, deleteNoteRest, fetchNotes, updateNoteRest } from "@/lib/api-notes";
import { settledState, sortNotes, toItem, type NoteItem, type SaveState } from "./notes-state";

/** Typing pauses this long before the edit is sent. */
export const NOTE_SAVE_DEBOUNCE_MS = 600;
const LOAD_ERROR = "Không tải được ghi chú.";

type LoadState = "loading" | "ready" | "error";

const messageOf = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Không lưu được ghi chú.";

/** Counts calls in flight and derives the visible save state (error sticks until the batch ends). */
function useSaveTracker(setSave: (s: SaveState) => void, setError: (m: string | null) => void) {
  const inflight = useRef(0);
  const failed = useRef(false);
  return useCallback(
    async <T>(call: Promise<T>): Promise<T | null> => {
      if (inflight.current === 0) failed.current = false;
      inflight.current += 1;
      setSave("saving");
      setError(null);
      try {
        return await call;
      } catch (cause) {
        failed.current = true;
        setError(messageOf(cause));
        return null;
      } finally {
        inflight.current -= 1;
        setSave(settledState(inflight.current, failed.current));
      }
    },
    [setSave, setError],
  );
}

/** Debounced PATCH per note: `schedule` keeps the latest text, `flush` sends it now. */
function useDebouncedEdits(meetingId: string, track: ReturnType<typeof useSaveTracker>) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latest = useRef(new Map<string, string>());

  const flush = useCallback(
    (id: string) => {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      const content = latest.current.get(id);
      latest.current.delete(id);
      if (content !== undefined) void track(updateNoteRest(meetingId, id, { content }));
    },
    [meetingId, track],
  );

  const schedule = useCallback(
    (id: string, content: string) => {
      latest.current.set(id, content);
      clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        setTimeout(() => flush(id), NOTE_SAVE_DEBOUNCE_MS),
      );
    },
    [flush],
  );

  const cancel = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    latest.current.delete(id);
  }, []);

  useEffect(() => {
    const pending = latest.current;
    return () => {
      for (const id of [...pending.keys()]) flush(id);
    };
  }, [flush]);

  return { schedule, flush, cancel };
}

interface LoadSinks {
  setNotes: (items: NoteItem[]) => void;
  setLoad: (state: LoadState) => void;
  setError: (message: string | null) => void;
}

function useLoadNotes(meetingId: string, { setNotes, setLoad, setError }: LoadSinks) {
  useEffect(() => {
    let cancelled = false;
    fetchNotes(meetingId)
      .then((loaded) => {
        if (cancelled) return;
        setNotes(sortNotes(loaded.map(toItem)));
        setLoad("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setError(LOAD_ERROR);
        setLoad("error");
      });
    return () => {
      cancelled = true;
    };
  }, [meetingId, setNotes, setLoad, setError]);
}

/** Loads the meeting's notes and exposes add / edit / remove with a visible save state. */
export function useMeetingNotes(meetingId: string) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [load, setLoad] = useState<LoadState>("loading");
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const tempSeq = useRef(0);
  const track = useSaveTracker(setSave, setError);
  const edits = useDebouncedEdits(meetingId, track);

  useLoadNotes(meetingId, { setNotes, setLoad, setError });

  /** Adds a note right away (pending) and resolves false when the server refused it. */
  const add = useCallback(
    async (content: string, atMs: number | null): Promise<boolean> => {
      const tempId = `pending-${++tempSeq.current}`;
      setNotes((prev) => sortNotes([...prev, { id: tempId, atMs, content, pending: true }]));
      const saved = await track(createNoteRest(meetingId, { content, atMs }));
      setNotes((prev) =>
        saved
          ? prev.map((n) => (n.id === tempId ? toItem(saved) : n))
          : prev.filter((n) => n.id !== tempId),
      );
      return saved !== null;
    },
    [meetingId, track],
  );

  const edit = useCallback(
    (id: string, content: string) => {
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
      if (content.trim()) edits.schedule(id, content);
    },
    [edits],
  );

  const remove = useCallback(
    async (id: string) => {
      edits.cancel(id);
      let removed: NoteItem | undefined;
      setNotes((prev) => {
        removed = prev.find((n) => n.id === id);
        return prev.filter((n) => n.id !== id);
      });
      const done = await track(deleteNoteRest(meetingId, id));
      if (done !== null) return;
      const restore = removed;
      if (restore) setNotes((prev) => sortNotes([...prev, restore]));
    },
    [edits, meetingId, track],
  );

  return { notes, load, save, error, add, edit, flush: edits.flush, remove };
}

export type MeetingNotesApi = ReturnType<typeof useMeetingNotes>;
