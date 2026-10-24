const DEFAULT_NEXT = "/";
/** Paths that must never be a post-login target. */
const LOGIN_PATH = "/login";

/**
 * Open-redirect guard: only same-origin *relative* paths survive. Rejects absolute URLs,
 * protocol-relative `//host`, backslash tricks (`/\host`), control characters and the login page.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return DEFAULT_NEXT;
  if (value.startsWith("//") || value.includes("\\")) return DEFAULT_NEXT;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return DEFAULT_NEXT;
  const path = value.split(/[?#]/)[0];
  if (path === LOGIN_PATH || path?.startsWith(`${LOGIN_PATH}/`)) return DEFAULT_NEXT;
  return value;
}

export function loginUrl(nextPath: string): string {
  const next = safeNextPath(nextPath);
  return next === DEFAULT_NEXT ? LOGIN_PATH : `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}
