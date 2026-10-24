import { COOKIE_NAME } from "./constants";

export interface CookieOptions {
  secure: boolean;
  /** Omit for a browser-session cookie. */
  maxAgeSec?: number;
}

/** `Set-Cookie` value for the session: HttpOnly, SameSite=Lax, Path=/. */
export function serializeSessionCookie(value: string, options: CookieOptions): string {
  const parts = [`${COOKIE_NAME}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (options.maxAgeSec !== undefined) parts.push(`Max-Age=${options.maxAgeSec}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function serializeClearedCookie(secure: boolean): string {
  return serializeSessionCookie("", { secure, maxAgeSec: 0 });
}

/** Reads one cookie from a raw `Cookie` header (used by the WebSocket upgrade). */
export function readCookie(
  header: string | undefined | null,
  name: string = COOKIE_NAME,
): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1 || part.slice(0, index).trim() !== name) continue;
    return part.slice(index + 1).trim() || null;
  }
  return null;
}
