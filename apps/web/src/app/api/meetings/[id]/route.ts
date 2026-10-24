import { NextResponse } from "next/server";
import { getRepositories } from "@/server/db";
import { checkSameOrigin, notFound, parseBody, respond } from "@/server/http";
import { deleteMeeting, getMeetingDetail } from "@/server/meetings-service";
import { patchMeetingSchema } from "@/server/schemas";
import { withAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withAuth(async (_request: Request, { params }: RouteContext) => {
  const { id } = await params;
  const detail = getMeetingDetail(id);
  return detail ? NextResponse.json(detail) : notFound();
});

export const PATCH = withAuth(async (request: Request, { params }: RouteContext) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const { id } = await params;
  const parsed = await parseBody(request, patchMeetingSchema);
  if (!parsed.ok) return parsed.response;
  const meeting = getRepositories().meetings.updateTitle(id, parsed.data.title);
  return meeting ? NextResponse.json({ meeting }) : notFound();
});

/** Soft delete (restorable via `POST .../restore`). 409 while the meeting is live. */
export const DELETE = withAuth(async (request: Request, { params }: RouteContext, session) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const { id } = await params;
  return respond(() => ({ meeting: deleteMeeting(id, session.user.id) }));
});
