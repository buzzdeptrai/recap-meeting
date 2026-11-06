import { updateNoteSchema } from "@recap/core";
import { checkSameOrigin, parseBody, respond } from "@/server/http";
import { deleteNote, updateNote } from "@/server/notes-service";
import { withMeetingAuth } from "@/server/meeting-auth";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; noteId: string }>;
}

export const PATCH = withMeetingAuth(async (request: Request, { params }: RouteContext) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const { id, noteId } = await params;
  const parsed = await parseBody(request, updateNoteSchema);
  if (!parsed.ok) return parsed.response;
  return respond(() => updateNote(id, noteId, parsed.data));
});

export const DELETE = withMeetingAuth(async (request: Request, { params }: RouteContext) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const { id, noteId } = await params;
  return respond(() => deleteNote(id, noteId));
});
