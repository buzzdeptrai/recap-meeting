import { withAuth } from "@/server/auth";
import { checkSameOrigin, respond } from "@/server/http";
import { restoreMeeting } from "@/server/meetings-service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Undoes a soft delete; idempotent (restoring a meeting that is not deleted just returns it). */
export const POST = withAuth(async (request: Request, { params }: RouteContext) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const { id } = await params;
  return respond(() => ({ meeting: restoreMeeting(id) }));
});
