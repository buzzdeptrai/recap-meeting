import { NextResponse } from "next/server";
import { parseQuery } from "@/server/http";
import { getSeries } from "@/server/usage-service";
import { seriesQuerySchema } from "@/server/usage-range";
import { withAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: Request) => {
  const parsed = parseQuery(request.url, seriesQuerySchema);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json(getSeries(parsed.data));
});
