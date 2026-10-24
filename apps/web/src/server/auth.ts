import { AuthService, COOKIE_NAME, readCookie, type AuthenticatedSession } from "@recap/auth";
import { getAuthSecret } from "./auth-secret";
import { getRepositories } from "./db";
import { jsonError } from "./http";
import { ServiceError } from "./service-error";

/**
 * Two-layer auth (why): `proxy.ts` only checks the cookie *signature* — cheap, no database, so it
 * is safe in any runtime and keeps anonymous traffic away from the app. The real check (session
 * row exists, not expired, user not disabled) needs SQLite, so it happens here, in route handlers
 * (`withAuth`) and layouts (`auth-page.ts`). A forged cookie never gets past the proxy; a
 * revoked or expired one never gets past this module.
 *
 * Server-only. Never import from client components.
 */
const globalForAuth = globalThis as typeof globalThis & { __recapAuth?: AuthService };

/** One service per process: the login rate limiter lives in memory and must survive hot reloads. */
export function getAuthService(): AuthService {
  globalForAuth.__recapAuth ??= new AuthService({
    repos: getRepositories(),
    secret: getAuthSecret(),
  });
  return globalForAuth.__recapAuth;
}

/** Test seam. */
export function setAuthServiceForTests(service: AuthService | undefined): void {
  globalForAuth.__recapAuth = service;
}

export const sessionCookieOf = (request: Request): string | null =>
  readCookie(request.headers.get("cookie"), COOKIE_NAME);

/** `Secure` only over https (also behind a proxy that sets `x-forwarded-proto`). */
export function isSecureRequest(request: Request): boolean {
  if (request.headers.get("x-forwarded-proto") === "https") return true;
  return new URL(request.url).protocol === "https:";
}

const TRUST_PROXY_ENV = "AUTH_TRUST_PROXY";
const UNKNOWN_IP = "direct";

/** Client IP for rate limiting. Forwarded headers are only believed when AUTH_TRUST_PROXY=true. */
export function clientIp(request: Request): string {
  if (process.env[TRUST_PROXY_ENV] !== "true") return UNKNOWN_IP;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || UNKNOWN_IP;
}

/** Throws `ServiceError(401)` unless the request carries a valid, live session. */
export function requireUser(request: Request): AuthenticatedSession {
  const session = getAuthService().authenticate(sessionCookieOf(request));
  if (!session) throw new ServiceError(401, "UNAUTHENTICATED", "Bạn cần đăng nhập để tiếp tục.");
  return session;
}

/** Like `requireUser`, plus `ServiceError(403)` for non-admins. */
export function requireAdmin(request: Request): AuthenticatedSession {
  const session = requireUser(request);
  if (session.user.role !== "admin") {
    throw new ServiceError(403, "FORBIDDEN", "Chỉ quản trị viên mới có quyền này.");
  }
  return session;
}

interface AuthOptions {
  /** Restrict to administrators. */
  admin?: boolean;
}

/**
 * Wraps a route handler so it only runs for a logged-in user (one line per route):
 * `export const GET = withAuth(async (request, context, session) => ...)`.
 */
export function withAuth<C = unknown>(
  handler: (
    request: Request,
    context: C,
    session: AuthenticatedSession,
  ) => Response | Promise<Response>,
  options: AuthOptions = {},
): (request: Request, context: C) => Promise<Response> {
  return async (request, context) => {
    try {
      const session = options.admin ? requireAdmin(request) : requireUser(request);
      return await handler(request, context, session);
    } catch (err) {
      if (err instanceof ServiceError) return jsonError(err.status, err.code, err.message);
      throw err;
    }
  };
}
