import { NextResponse } from "next/server";
import { parseQuery } from "@/server/http";
import { getReliability } from "@/server/usage-service";
import { reliabilityQuerySchema } from "@/server/usage-range";
import { withAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: Request) => {
  const parsed = parseQuery(request.url, reliabilityQuerySchema);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json(getReliability(parsed.data));
});
