import { z } from "zod";

/** Max length of one hand-typed meeting note. */
export const NOTE_CONTENT_MAX = 1_000;
/** Max notes per meeting (keeps the minutes prompt bounded). */
export const NOTES_PER_MEETING_MAX = 150;

const noteContentSchema = z
  .string()
  .trim()
  .min(1, "Ghi chú không được để trống")
  .max(NOTE_CONTENT_MAX, `Ghi chú tối đa ${NOTE_CONTENT_MAX} ký tự`);

/** Offset into the meeting in ms; null = a note that is not time-stamped. */
const noteOffsetSchema = z.number().int().nonnegative().nullable();

export const createNoteSchema = z.object({
  content: noteContentSchema,
  atMs: noteOffsetSchema.optional(),
});

export const updateNoteSchema = z
  .object({ content: noteContentSchema.optional(), atMs: noteOffsetSchema.optional() })
  .refine((body) => body.content !== undefined || body.atMs !== undefined, {
    message: "Cần content hoặc atMs",
  });

/** A hand note as the client sees it. */
export interface Note {
  id: string;
  atMs: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}
