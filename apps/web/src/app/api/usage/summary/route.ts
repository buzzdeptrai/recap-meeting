import { NextResponse } from "next/server";
import { parseQuery } from "@/server/http";
import { getSummary } from "@/server/usage-service";
import { summaryQuerySchema } from "@/server/usage-range";
import { withAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: Request) => {
  const parsed = parseQuery(request.url, summaryQuerySchema);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json(getSummary(parsed.data));
});
