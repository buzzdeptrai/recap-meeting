import { canAccessMeeting, type MeetingViewer } from "@recap/core";
import type { AuthenticatedSession } from "@recap/auth";
import { withAuth } from "./auth";
import { getRepositories } from "./db";
import { notFound } from "./http";

interface MeetingRouteContext {
  params: Promise<{ id: string }>;
}

/** Session user as the viewer the access rule works with. */
export const viewerOf = (session: AuthenticatedSession): MeetingViewer => ({
  id: session.user.id,
  role: session.user.role,
});

/**
 * Whether `viewer` may reach meeting `id`. Soft-deleted meetings are looked up too (restore and
 * the trash need their owner); the services still hide deleted rows where they should. Unknown
 * and not-yours are indistinguishable on purpose.
 */
export function canViewerAccessMeeting(viewer: MeetingViewer, id: string): boolean {
  const meeting = getRepositories().meetings.getIncludingDeleted(id);
  return meeting !== undefined && canAccessMeeting(viewer, meeting.ownerId);
}

/**
 * `withAuth` plus the ownership rule for every route under `/api/meetings/[id]/`: a meeting that
 * does not exist or belongs to someone else answers 404 NOT_FOUND before the handler runs.
 * A test requires this wrapper on every such route, so a new route cannot forget it.
 */
export function withMeetingAuth<C extends MeetingRouteContext>(
  handler: (
    request: Request,
    context: C,
    session: AuthenticatedSession,
  ) => Response | Promise<Response>,
): (request: Request, context: C) => Promise<Response> {
  return withAuth<C>(async (request, context, session) => {
    const { id } = await context.params;
    if (!canViewerAccessMeeting(viewerOf(session), id)) return notFound();
    return handler(request, context, session);
  });
}
