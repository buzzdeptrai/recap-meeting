import { NextResponse } from "next/server";
import { parseQuery } from "@/server/http";
import { getBreakdown } from "@/server/usage-service";
import { breakdownQuerySchema } from "@/server/usage-range";
import { withAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: Request) => {
  const parsed = parseQuery(request.url, breakdownQuerySchema);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json(getBreakdown(parsed.data));
});
