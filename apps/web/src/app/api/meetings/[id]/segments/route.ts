import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth";
import { notFound, parseQuery } from "@/server/http";
import { getMeetingById } from "@/server/meetings-service";
import { loadSegmentsPage } from "@/server/transcript-service";
import { segmentsQuerySchema } from "@/server/transcript-schemas";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** One page of the transcript by `seq` cursor: `?from=&limit=&dir=forward|backward`. */
export const GET = withAuth(async (request: Request, { params }: RouteContext) => {
  const { id } = await params;
  if (!getMeetingById(id)) return notFound();
  const parsed = parseQuery(request.url, segmentsQuerySchema);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json(loadSegmentsPage(id, parsed.data));
});
