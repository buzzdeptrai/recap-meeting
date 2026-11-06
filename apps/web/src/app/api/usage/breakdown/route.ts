import { NextResponse } from "next/server";
import { parseQuery } from "@/server/http";
import { getBreakdown, usageDepsFor } from "@/server/usage-service";
import { breakdownQuerySchema } from "@/server/usage-range";
import { withAuth } from "@/server/auth";
import { viewerOf } from "@/server/meeting-auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: Request, _context: unknown, session) => {
  const parsed = parseQuery(request.url, breakdownQuerySchema);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json(getBreakdown(parsed.data, usageDepsFor(viewerOf(session))));
});
