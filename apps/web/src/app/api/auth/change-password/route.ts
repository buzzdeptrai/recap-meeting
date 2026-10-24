import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthService, withAuth } from "@/server/auth";
import { checkSameOrigin, jsonError, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const MAX_PASSWORD = 256;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(MAX_PASSWORD),
  newPassword: z.string().max(MAX_PASSWORD),
});

/** Signs out every other session of the user; the current one stays. */
export const POST = withAuth(async (request, _context, session) => {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const parsed = await parseBody(request, changePasswordSchema);
  if (!parsed.ok) return parsed.response;
  const result = await getAuthService().changePassword(
    session.user.id,
    session.sessionId,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );
  if (!result.ok) return jsonError(400, "VALIDATION", result.message);
  return NextResponse.json({ ok: true });
});
