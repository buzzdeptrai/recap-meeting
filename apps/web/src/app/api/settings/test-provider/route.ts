import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/server/auth";
import { checkSameOrigin, parseBody } from "@/server/http";
import { PROVIDER_IDS } from "@/server/provider-status";
import { testProvider } from "@/server/provider-test";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ vendor: z.enum(PROVIDER_IDS as [string, ...string[]]) });

/** Admin only. `POST {vendor}` -> `{ok, latencyMs, message}`: one free list call, 5 s deadline, no secrets. */
export const POST = withAuth(
  async (request: Request) => {
    const forbidden = checkSameOrigin(request);
    if (forbidden) return forbidden;
    const parsed = await parseBody(request, bodySchema);
    if (!parsed.ok) return parsed.response;
    const result = await testProvider(parsed.data.vendor as (typeof PROVIDER_IDS)[number]);
    return NextResponse.json(result);
  },
  { admin: true },
);
