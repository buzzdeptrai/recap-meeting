import type { Note } from "@recap/core";
import type { ApiErrorBody } from "./api-types";

const FALLBACK_ERROR = "Không lưu được ghi chú. Hãy thử lại.";
const JSON_HEADERS = { "content-type": "application/json" };

const notesUrl = (meetingId: string) => `/api/meetings/${encodeURIComponent(meetingId)}/notes`;
const noteUrl = (meetingId: string, noteId: string) =>
  `${notesUrl(meetingId)}/${encodeURIComponent(noteId)}`;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (response.ok) return (await response.json()) as T;
  let message = FALLBACK_ERROR;
  try {
    message = ((await response.json()) as ApiErrorBody).error?.message ?? message;
  } catch {
    // keep the generic message
  }
  throw new Error(message);
}

export async function fetchNotes(meetingId: string): Promise<Note[]> {
  return (await request<{ notes: Note[] }>(notesUrl(meetingId))).notes;
}

export async function createNoteRest(
  meetingId: string,
  body: { content: string; atMs: number | null },
): Promise<Note> {
  const init = { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) };
  return (await request<{ note: Note }>(notesUrl(meetingId), init)).note;
}

export async function updateNoteRest(
  meetingId: string,
  noteId: string,
  body: { content: string },
): Promise<Note> {
  const init = { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(body) };
  return (await request<{ note: Note }>(noteUrl(meetingId, noteId), init)).note;
}

export async function deleteNoteRest(meetingId: string, noteId: string): Promise<void> {
  await request<{ id: string }>(noteUrl(meetingId, noteId), { method: "DELETE" });
}
