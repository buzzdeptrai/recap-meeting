import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SEPARATOR = ".";

const sign = (sessionId: string, secret: string): string =>
  createHmac("sha256", secret).update(sessionId).digest("base64url");

/** Cookie value `<sessionId>.<hmac-sha256 base64url>`. */
export function signSessionValue(sessionId: string, secret: string): string {
  return `${sessionId}${SEPARATOR}${sign(sessionId, secret)}`;
}

/** Returns the session id when the signature is valid, otherwise null (never throws). */
export function verifySessionValue(
  value: string | undefined | null,
  secret: string,
): string | null {
  if (!value) return null;
  const index = value.lastIndexOf(SEPARATOR);
  if (index <= 0) return null;
  const id = value.slice(0, index);
  const given = Buffer.from(value.slice(index + 1));
  const expected = Buffer.from(sign(id, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return id;
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Constant-time string comparison independent of length (compares SHA-256 digests). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

/** Service token (tools): disabled when `expected` is empty; accepts `Bearer <token>`. */
export function verifyServiceToken(
  authorization: string | undefined | null,
  expected: string | undefined,
): boolean {
  if (!expected || !authorization) return false;
  const match = /^Bearer (.+)$/.exec(authorization);
  return match?.[1] !== undefined && safeEqual(match[1], expected);
}
