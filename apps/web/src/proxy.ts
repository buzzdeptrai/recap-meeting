import { COOKIE_NAME, verifySessionValue } from "@recap/auth";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthSecret } from "@/server/auth-secret";
import { loginUrl } from "@/lib/safe-redirect";

/**
 * Request interception (Next 16 renamed `middleware` to `proxy`; Node.js runtime).
 *
 * Only the cheap check lives here: is the cookie a validly *signed* session value? Whether the
 * session still exists in SQLite, has not expired and belongs to an enabled user is checked by
 * `requireUser` / `withAuth` in route handlers and layouts (`server/auth.ts`). Keeping the
 * database out of the proxy means it stays runtime-agnostic and fast.
 */
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout", "/favicon.ico"]);
const PUBLIC_PREFIXES = ["/worklets/"];

const isPublic = (pathname: string): boolean =>
  PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const signed = verifySessionValue(request.cookies.get(COOKIE_NAME)?.value, getAuthSecret());
  if (signed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Bạn cần đăng nhập để tiếp tục." } },
      { status: 401 },
    );
  }
  const target = new URL(loginUrl(`${pathname}${search}`), request.url);
  return NextResponse.redirect(target);
}

export const config = {
  // Everything except Next internals; static files in /public are matched by the extension rule.
  matcher: ["/((?!_next/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|txt)$).*)"],
};
