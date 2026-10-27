import type { StoredNote } from "@recap/db";
import { formatTimestamp } from "./transcript";

export interface NoteLine {
  /** Offset into the meeting; null = not time-stamped. */
  atMs: number | null;
  /** `[mm:ss] text` or `- text`, always one line. */
  text: string;
}

const WHITESPACE_RUN = /\s+/g;

/** A note is one prompt line: newlines cannot be used to fake extra lines or markers. */
export function buildNoteLines(
  notes: ReadonlyArray<Pick<StoredNote, "atMs" | "content">>,
): NoteLine[] {
  return notes
    .map((note) => ({ atMs: note.atMs, content: note.content.replace(WHITESPACE_RUN, " ").trim() }))
    .filter((note) => note.content !== "")
    .map(({ atMs, content }) => ({
      atMs,
      text: atMs === null ? `- ${content}` : `[${formatTimestamp(atMs)}] ${content}`,
    }));
}

/** Notes of the chunk that holds their moment (the first chunk takes the lead-in, the last the tail). */
export function notesOfChunk(
  chunks: ReadonlyArray<ReadonlyArray<{ startMs: number }>>,
  index: number,
  notes: readonly NoteLine[],
): NoteLine[] {
  const start = index === 0 ? Number.NEGATIVE_INFINITY : (chunks[index]?.[0]?.startMs ?? 0);
  const next = chunks[index + 1]?.[0]?.startMs ?? Number.POSITIVE_INFINITY;
  return notes.filter((n) => n.atMs !== null && n.atMs >= start && n.atMs < next);
}

export const untimedNotes = (notes: readonly NoteLine[]): NoteLine[] =>
  notes.filter((n) => n.atMs === null);
