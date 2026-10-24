import { NextResponse } from "next/server";
import { parseQuery } from "@/server/http";
import { getTopMeetings } from "@/server/usage-service";
import { meetingsQuerySchema } from "@/server/usage-range";
import { withAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: Request) => {
  const parsed = parseQuery(request.url, meetingsQuerySchema);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json(getTopMeetings(parsed.data));
});
