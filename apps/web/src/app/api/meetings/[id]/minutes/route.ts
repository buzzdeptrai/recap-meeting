import { checkSameOrigin, jsonError, parseBody, respond } from "@/server/http";
import { startMinutesRun } from "@/server/minutes-run-service";
import { getMinutes, saveEditedMinutes } from "@/server/minutes-service";
import { generateMinutesSchema, minutesQuerySchema, saveMinutesSchema } from "@/server/schemas";
import { withAuth } from "@/server/auth";

export const dynamic = "force-dynamic";
// Enqueue only: the model runs in the realtime worker after the 202.
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withAuth(async (request: Request, { params }: RouteContext) => {
  const { id } = await params;
  const query = minutesQuerySchema.safeParse({
    lang: new URL(request.url).searchParams.get("lang"),
  });
  if (!query.success) return jsonError(400, "VALIDATION", "lang: phải là vi hoặc en");
  return respond(() => getMinutes(id, query.data.lang));
});

const HTTP_ACCEPTED = 202;

/** Enqueues (or joins) a background generation; progress is read from `GET .../minutes/run`. */
export const POST = withAuth(async (request: Request, { params }: RouteContext) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const { id } = await params;
  const parsed = await parseBody(request, generateMinutesSchema);
  if (!parsed.ok) return parsed.response;
  return respond(() => startMinutesRun(id, parsed.data.lang), HTTP_ACCEPTED);
});

export const PUT = withAuth(async (request: Request, { params }: RouteContext) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const { id } = await params;
  const parsed = await parseBody(request, saveMinutesSchema);
  if (!parsed.ok) return parsed.response;
  return respond(() => saveEditedMinutes(id, parsed.data.lang, parsed.data.content));
});
