import { withMeetingAuth } from "@/server/meeting-auth";
import { checkSameOrigin, respond } from "@/server/http";
import { restoreMeeting } from "@/server/meetings-service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Undoes a soft delete; idempotent (restoring a meeting that is not deleted just returns it). */
export const POST = withMeetingAuth(async (request: Request, { params }: RouteContext) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const { id } = await params;
  return respond(() => ({ meeting: restoreMeeting(id) }));
});
