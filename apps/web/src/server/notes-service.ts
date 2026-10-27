import {
  NOTES_PER_MEETING_MAX,
  type Note,
  type createNoteSchema,
  type updateNoteSchema,
} from "@recap/core";
import type { Repositories, StoredNote } from "@recap/db";
import type { z } from "zod";
import { getRepositories } from "./db";
import { requireMeeting } from "./minutes-service";
import { ServiceError } from "./service-error";

export type CreateNoteBody = z.infer<typeof createNoteSchema>;
export type UpdateNoteBody = z.infer<typeof updateNoteSchema>;

const noteNotFound = () => new ServiceError(404, "NOT_FOUND", "Không tìm thấy ghi chú này.");

function toNote(stored: StoredNote): Note {
  const { id, atMs, content, createdAt, updatedAt } = stored;
  return { id, atMs, content, createdAt, updatedAt };
}

/** Notes of a live or ended meeting, in meeting order (untimed last). */
export function listNotes(
  meetingId: string,
  repos: Repositories = getRepositories(),
): { notes: Note[] } {
  requireMeeting(repos, meetingId);
  return { notes: repos.notes.list(meetingId).map(toNote) };
}

export function createNote(
  meetingId: string,
  body: CreateNoteBody,
  repos: Repositories = getRepositories(),
): { note: Note } {
  requireMeeting(repos, meetingId);
  if (repos.notes.count(meetingId) >= NOTES_PER_MEETING_MAX) {
    throw new ServiceError(
      409,
      "TOO_MANY_NOTES",
      `Mỗi cuộc họp tối đa ${NOTES_PER_MEETING_MAX} ghi chú.`,
    );
  }
  return { note: toNote(repos.notes.insert({ meetingId, ...body })) };
}

export function updateNote(
  meetingId: string,
  noteId: string,
  body: UpdateNoteBody,
  repos: Repositories = getRepositories(),
): { note: Note } {
  requireMeeting(repos, meetingId);
  const stored = repos.notes.update(meetingId, noteId, body);
  if (!stored) throw noteNotFound();
  return { note: toNote(stored) };
}

export function deleteNote(
  meetingId: string,
  noteId: string,
  repos: Repositories = getRepositories(),
): { id: string } {
  requireMeeting(repos, meetingId);
  if (!repos.notes.remove(meetingId, noteId)) throw noteNotFound();
  return { id: noteId };
}
