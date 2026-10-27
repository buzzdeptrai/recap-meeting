"use client";

import { Button } from "@recap/admin-ui";
import { NOTES_PER_MEETING_MAX } from "@recap/core";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { MeetingNotesApi } from "./use-meeting-notes";
import { isDuplicateNote, placeAction, type ActionPlacement } from "./selection-note";
import { useTranscriptSelection } from "./use-transcript-selection";

/** How long the "Đã thêm" / error line stays before the action goes away. */
const FEEDBACK_MS = 1800;
const DUPLICATE_MESSAGE = "Đoạn này đã có trong ghi chú.";
const LIMIT_MESSAGE = `Mỗi cuộc họp tối đa ${NOTES_PER_MEETING_MAX} ghi chú.`;
const FALLBACK_ERROR = "Không thêm được ghi chú.";

type Phase = { kind: "idle" } | { kind: "done" } | { kind: "fail"; message: string };

interface SelectionNoteActionProps {
  /** The scrolling transcript element; only selections inside it count. */
  scrollerRef: RefObject<HTMLElement | null>;
  /** Positioned ancestor the action is absolutely placed in. */
  frameRef: RefObject<HTMLElement | null>;
  notes: MeetingNotesApi;
}

/** Visible part of the frame, in viewport coordinates. */
function frameBounds(frame: HTMLElement) {
  const r = frame.getBoundingClientRect();
  return {
    left: Math.max(r.left, 0),
    top: Math.max(r.top, 0),
    right: Math.min(r.right, window.innerWidth),
    bottom: Math.min(r.bottom, window.innerHeight),
  };
}

type Selected = NonNullable<ReturnType<typeof useTranscriptSelection>["selection"]>;

/** Where the action goes (relative to the frame), measured after it renders. */
function useActionSpot(frameRef: RefObject<HTMLElement | null>, selection: Selected | null) {
  const box = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<ActionPlacement | null>(null);
  // Runs every render on purpose: the action's text (and so its size) changes with the feedback
  // phase. No loop: setSpot returns the previous object when the spot is unchanged.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const el = box.current;
    if (!selection || !frame || !el) return;
    const size = { width: el.offsetWidth, height: el.offsetHeight };
    const at = placeAction(selection, size, frameBounds(frame));
    const origin = frame.getBoundingClientRect();
    const next = { left: at.left - origin.left, top: at.top - origin.top };
    setSpot((prev) => (prev && prev.left === next.left && prev.top === next.top ? prev : next));
  });
  return { box, spot: selection ? spot : null };
}

/** Feedback belongs to one selection; it clears itself (and hides the action) after a moment. */
function useFeedback(selection: Selected | null, dismiss: () => void) {
  const [state, setState] = useState<{ key: string; phase: Phase } | null>(null);
  useEffect(() => {
    if (!state) return;
    const timer = setTimeout(() => {
      setState(null);
      dismiss();
    }, FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [state, dismiss]);
  const phase: Phase = state && state.key === selection?.key ? state.phase : { kind: "idle" };
  return { phase, show: (key: string, next: Phase) => setState({ key, phase: next }) };
}

/**
 * Small floating "Thêm vào ghi chú" next to a transcript selection. It sits right after the
 * transcript in the DOM (Tab reaches it), never takes focus itself and keeps the selection intact
 * (mousedown is default-prevented).
 */
export function SelectionNoteAction({ scrollerRef, frameRef, notes }: SelectionNoteActionProps) {
  const { selection, dismiss } = useTranscriptSelection(scrollerRef);
  const { box, spot } = useActionSpot(frameRef, selection);
  const { phase, show } = useFeedback(selection, dismiss);
  if (!selection) return null;

  const add = async () => {
    const { draft, key } = selection;
    if (isDuplicateNote(notes.notes, draft)) return show(key, fail(DUPLICATE_MESSAGE));
    if (notes.notes.length >= NOTES_PER_MEETING_MAX) return show(key, fail(LIMIT_MESSAGE));
    const ok = await notes.add(draft.content, draft.atMs);
    show(key, ok ? { kind: "done" } : fail(FALLBACK_ERROR));
  };

  return (
    <div
      ref={box}
      style={{
        left: spot?.left ?? 0,
        top: spot?.top ?? 0,
        visibility: spot ? "visible" : "hidden",
      }}
      className="absolute z-20 rounded-xl bg-soft-surface shadow-soft-pop"
    >
      {phase.kind === "idle" ? (
        <Button
          type="button"
          variant="plain"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={add}
        >
          Thêm vào ghi chú
        </Button>
      ) : (
        <p
          role="status"
          className={`px-3 py-1.5 text-small ${phase.kind === "done" ? "text-soft-ink" : "text-err"}`}
        >
          {phase.kind === "done" ? "Đã thêm vào ghi chú" : failText(phase.message, notes.error)}
        </p>
      )}
    </div>
  );
}

const fail = (message: string): Phase => ({ kind: "fail", message });

/** The server's own message (e.g. the 150-note limit) wins over the generic one. */
function failText(message: string, serverError: string | null): string {
  return message === FALLBACK_ERROR && serverError ? serverError : message;
}
