import { NextResponse } from "next/server";
import { getRepositories } from "@/server/db";
import { checkSameOrigin, parseBody, parseQuery } from "@/server/http";
import { listDeletedMeetings, listMeetings } from "@/server/meetings-service";
import { createMeetingSchema, listMeetingsQuerySchema } from "@/server/schemas";
import { withAuth } from "@/server/auth";
import { viewerOf } from "@/server/meeting-auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: Request, _context: unknown, session) => {
  const viewer = viewerOf(session);
  const parsed = parseQuery(request.url, listMeetingsQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { deleted, limit, offset, ...filters } = parsed.data;
  if (deleted) return NextResponse.json(listDeletedMeetings(viewer, limit, offset));
  return NextResponse.json(listMeetings(viewer, { ...filters, limit, offset }));
});

export const POST = withAuth(async (request: Request, _context: unknown, session) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const parsed = await parseBody(request, createMeetingSchema);
  if (!parsed.ok) return parsed.response;
  const { title, sourceLang, targetLang, agenda, templateId, extraInstructions } = parsed.data;
  const meeting = getRepositories().meetings.create({
    title,
    sourceLang,
    targetLang,
    agenda: agenda || null,
    templateId,
    extraInstructions: extraInstructions || null,
    ownerId: session.user.id,
  });
  return NextResponse.json({ meeting }, { status: 201 });
});
