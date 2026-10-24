import { REMEMBER_COOKIE_MAX_AGE_SEC, serializeSessionCookie } from "@recap/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, getAuthService, isSecureRequest } from "@/server/auth";
import { checkSameOrigin, jsonError, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const MAX_EMAIL = 254;
const MAX_PASSWORD = 256;

const loginSchema = z.object({
  email: z.string().trim().min(1).max(MAX_EMAIL),
  password: z.string().min(1).max(MAX_PASSWORD),
  remember: z.boolean().optional(),
});

/** Generic on purpose: the same answer for unknown email, wrong password and disabled account. */
const INVALID_MESSAGE = "Email hoặc mật khẩu không đúng.";
const LOCKED_MESSAGE = "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.";
const SERVER_MESSAGE = "Không đăng nhập được do lỗi máy chủ. Vui lòng thử lại.";

export async function POST(request: Request) {
  const forbidden = checkSameOrigin(request);
  if (forbidden) return forbidden;
  const parsed = await parseBody(request, loginSchema);
  if (!parsed.ok) return jsonError(400, "VALIDATION", INVALID_MESSAGE);
  const { email, password, remember } = parsed.data;
  try {
    const result = await getAuthService().login({
      email,
      password,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    });
    if (!result.ok && result.reason === "locked") {
      const response = jsonError(429, "LOCKED", LOCKED_MESSAGE);
      response.headers.set("Retry-After", String(result.retryAfterSec ?? 0));
      return response;
    }
    if (!result.ok) return jsonError(401, "INVALID_CREDENTIALS", INVALID_MESSAGE);
    const response = NextResponse.json({ user: result.user });
    response.headers.append(
      "set-cookie",
      serializeSessionCookie(result.cookieValue, {
        secure: isSecureRequest(request),
        ...(remember ? { maxAgeSec: REMEMBER_COOKIE_MAX_AGE_SEC } : {}),
      }),
    );
    return response;
  } catch (error) {
    console.error("[auth] login failed:", error instanceof Error ? error.message : "error");
    return jsonError(500, "SERVER_ERROR", SERVER_MESSAGE);
  }
}
