/** Hostnames always accepted when no explicit allow-list is configured (local use only). */
export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Browsers always send `Origin` on WebSocket upgrades, so this is the defence against a random
 * website opening a socket to the local server. Requests without an Origin come from non-browser
 * clients (tools, tests) and cannot be driven by a web page, so they are allowed.
 *
 * `allowed` entries: `*` (anything), a full origin (`http://192.168.1.5:3000`) or a bare hostname
 * (`localhost`, any port and scheme http/https).
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowed: readonly string[] = DEFAULT_ALLOWED_ORIGINS,
): boolean {
  if (origin === undefined) return true;
  if (allowed.includes("*")) return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return allowed.some((entry) =>
    entry.includes("://") ? entry === url.origin : entry === url.hostname,
  );
}

/** `REALTIME_ALLOWED_ORIGINS=a,b` → list; blank/unset → defaults. */
export function parseAllowedOrigins(value: string | undefined): readonly string[] {
  const items = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : DEFAULT_ALLOWED_ORIGINS;
}
