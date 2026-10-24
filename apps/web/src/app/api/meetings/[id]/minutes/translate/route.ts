import { withAuth } from "@/server/auth";
import { checkSameOrigin, parseBody, respond } from "@/server/http";
import { startTranslationRun } from "@/server/minutes-translate-service";
import { translateMinutesSchema } from "@/server/schemas";

export const dynamic = "force-dynamic";
// Enqueue only: the model runs in the realtime worker after the 202.
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ id: string }>;
}

const HTTP_ACCEPTED = 202;

/** Enqueues a translation into `lang` from the other language; progress via `GET .../minutes/run`. */
export const POST = withAuth(async (request: Request, { params }: RouteContext) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const { id } = await params;
  const parsed = await parseBody(request, translateMinutesSchema);
  if (!parsed.ok) return parsed.response;
  const { lang, confirmOverwrite } = parsed.data;
  return respond(() => startTranslationRun(id, lang, { confirmOverwrite }), HTTP_ACCEPTED);
});
