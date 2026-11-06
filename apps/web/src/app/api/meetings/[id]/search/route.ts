import { NextResponse } from "next/server";
import { withMeetingAuth } from "@/server/meeting-auth";
import { notFound, parseQuery } from "@/server/http";
import { searchTranscript } from "@/server/transcript-service";
import { transcriptSearchQuerySchema } from "@/server/transcript-schemas";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Find words in one meeting's transcript and translations: `?q=&limit=`. */
export const GET = withMeetingAuth(async (request: Request, { params }: RouteContext) => {
  const { id } = await params;
  const parsed = parseQuery(request.url, transcriptSearchQuerySchema);
  if (!parsed.ok) return parsed.response;
  const result = searchTranscript(id, parsed.data);
  return result ? NextResponse.json(result) : notFound();
});
