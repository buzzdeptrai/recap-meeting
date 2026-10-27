import { createNoteSchema } from "@recap/core";
import { checkSameOrigin, parseBody, respond } from "@/server/http";
import { createNote, listNotes } from "@/server/notes-service";
import { withAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const HTTP_CREATED = 201;

export const GET = withAuth(async (_request: Request, { params }: RouteContext) => {
  const { id } = await params;
  return respond(() => listNotes(id));
});

export const POST = withAuth(async (request: Request, { params }: RouteContext) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const { id } = await params;
  const parsed = await parseBody(request, createNoteSchema);
  if (!parsed.ok) return parsed.response;
  return respond(() => createNote(id, parsed.data), HTTP_CREATED);
});
