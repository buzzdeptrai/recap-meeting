import { checkSameOrigin, parseBody, respond } from "@/server/http";
import { deleteMark, patchMarkSchema, renameMark } from "@/server/marks-service";
import { withMeetingAuth } from "@/server/meeting-auth";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; markId: string }>;
}

export const PATCH = withMeetingAuth(async (request: Request, { params }: RouteContext) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const { id, markId } = await params;
  const parsed = await parseBody(request, patchMarkSchema);
  if (!parsed.ok) return parsed.response;
  return respond(() => ({ mark: renameMark(id, markId, parsed.data.label) }));
});

export const DELETE = withMeetingAuth(async (request: Request, { params }: RouteContext) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const { id, markId } = await params;
  return respond(() => deleteMark(id, markId));
});
