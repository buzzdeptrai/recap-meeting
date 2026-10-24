import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth";
import { jsonError, notFound, parseQuery } from "@/server/http";
import { getMeetingById } from "@/server/meetings-service";
import { locateSegment } from "@/server/transcript-service";
import { locateQuerySchema } from "@/server/transcript-schemas";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Cursor of the page holding a time (`?atMs=`) or a segment (`?seq=`). */
export const GET = withAuth(async (request: Request, { params }: RouteContext) => {
  const { id } = await params;
  const parsed = parseQuery(request.url, locateQuerySchema);
  if (!parsed.ok) return parsed.response;
  const located = locateSegment(id, parsed.data);
  if (located) return NextResponse.json(located);
  return getMeetingById(id)
    ? jsonError(404, "SEGMENT_NOT_FOUND", "Không có đoạn nào ở vị trí này.")
    : notFound();
});
