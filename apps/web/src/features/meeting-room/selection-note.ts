import { NOTE_CONTENT_MAX } from "@recap/core";
import type { NoteItem } from "./notes-state";

/** Appended when a selection is longer than a note may be (counts inside the limit). */
export const NOTE_ELLIPSIS = "…";
/** Gap between the selection and the floating action, and the minimum distance to the edges. */
export const ACTION_GAP_PX = 8;
export const ACTION_EDGE_PX = 8;

export interface SelectionDraft {
  content: string;
  atMs: number | null;
}

/** Collapses every run of whitespace (line breaks from several rows included) to one space. */
export function normalizeSelectionText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Fits the text into one note: over the limit it is cut and ends with an ellipsis. Empty -> null. */
export function fitNoteContent(text: string, max = NOTE_CONTENT_MAX): string | null {
  const clean = normalizeSelectionText(text);
  if (clean === "") return null;
  if (clean.length <= max) return clean;
  return clean.slice(0, max - NOTE_ELLIPSIS.length).trimEnd() + NOTE_ELLIPSIS;
}

/** `data-start-ms` of a segment row -> whole-ms offset, or null when missing or not a number. */
export function parseStartMs(attr: string | null | undefined): number | null {
  if (attr === null || attr === undefined || attr.trim() === "") return null;
  const value = Number(attr);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

/** Selected text + start attribute of the row where the selection begins -> the note to create. */
export function buildSelectionDraft(
  rawText: string,
  startAttr: string | null | undefined,
): SelectionDraft | null {
  const content = fitNoteContent(rawText);
  if (content === null) return null;
  return { content, atMs: parseStartMs(startAttr) };
}

/** Same text at the same offset already exists (pending notes count). */
export function isDuplicateNote(notes: readonly NoteItem[], draft: SelectionDraft): boolean {
  return notes.some(
    (note) => note.atMs === draft.atMs && normalizeSelectionText(note.content) === draft.content,
  );
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ActionPlacement {
  left: number;
  top: number;
}

/**
 * Places the action under the end of the selection (right-aligned to it), flips above the first
 * line when there is no room below, and always keeps it inside `bounds`.
 */
export function placeAction(
  selection: { first: Box; last: Box },
  size: { width: number; height: number },
  bounds: Box,
): ActionPlacement {
  const minLeft = bounds.left + ACTION_EDGE_PX;
  const maxLeft = Math.max(minLeft, bounds.right - ACTION_EDGE_PX - size.width);
  const minTop = bounds.top + ACTION_EDGE_PX;
  const maxTop = Math.max(minTop, bounds.bottom - ACTION_EDGE_PX - size.height);
  const below = selection.last.bottom + ACTION_GAP_PX;
  const above = selection.first.top - ACTION_GAP_PX - size.height;
  const top = below <= maxTop ? below : above;
  const left = selection.last.right - size.width;
  return {
    left: Math.min(Math.max(left, minLeft), maxLeft),
    top: Math.min(Math.max(top, minTop), maxTop),
  };
}
