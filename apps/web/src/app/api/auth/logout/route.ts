import { serializeClearedCookie } from "@recap/auth";
import { NextResponse } from "next/server";
import { getAuthService, isSecureRequest, sessionCookieOf } from "@/server/auth";
import { checkSameOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

/** Idempotent: always clears the cookie, even when the session is already gone. */
export function POST(request: Request) {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  getAuthService().logout(sessionCookieOf(request));
  const response = NextResponse.json({ ok: true });
  response.headers.append("set-cookie", serializeClearedCookie(isSecureRequest(request)));
  return response;
}
