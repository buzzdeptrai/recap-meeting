import type { Note } from "@recap/core";

/** A note in the room: the stored fields plus `pending` while the create call is in flight. */
export interface NoteItem {
  id: string;
  atMs: number | null;
  content: string;
  pending?: boolean;
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  saving: "Đang lưu...",
  saved: "Đã lưu",
  error: "Chưa lưu được",
};

/** Same order as the server: timed notes by offset (stable), untimed notes after them. */
export function sortNotes<T extends { atMs: number | null }>(items: readonly T[]): T[] {
  const timed = items.filter((n) => n.atMs !== null);
  const untimed = items.filter((n) => n.atMs === null);
  return [...timed.sort((a, b) => (a.atMs as number) - (b.atMs as number)), ...untimed];
}

export function toItem(note: Note): NoteItem {
  return { id: note.id, atMs: note.atMs, content: note.content };
}

/** Save indicator after one call settles: error wins while any call failed, else idle/saved. */
export function settledState(inflight: number, failed: boolean): SaveState {
  if (inflight > 0) return "saving";
  return failed ? "error" : "saved";
}

/** The offset a new note is stamped with: meeting time while recording, otherwise none. */
export function noteOffset(
  clockOrigin: number | null,
  recording: boolean,
  now: number,
): number | null {
  if (!recording || clockOrigin === null) return null;
  return Math.max(0, now - clockOrigin);
}
