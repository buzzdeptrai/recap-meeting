import type { IncomingHttpHeaders } from "node:http";
import { readCookie } from "./cookie";
import type { AuthService } from "./service";
import { verifyServiceToken } from "./token";
import type { AuthUser } from "./types";

export type UpgradeAuthResult =
  { ok: true; kind: "user"; user: AuthUser } | { ok: true; kind: "service" } | { ok: false };

export interface UpgradeAuthenticator {
  authenticate(headers: IncomingHttpHeaders): UpgradeAuthResult;
}

/**
 * WebSocket upgrade check: a signed session cookie (browsers) or the optional service token as
 * `Authorization: Bearer` (tools). Without `serviceToken` the bearer path is disabled.
 */
export function createUpgradeAuthenticator(
  auth: AuthService,
  serviceToken?: string,
): UpgradeAuthenticator {
  return {
    authenticate(headers) {
      if (verifyServiceToken(headers.authorization, serviceToken)) {
        return { ok: true, kind: "service" };
      }
      const user = auth.getSessionUser(readCookie(headers.cookie));
      return user ? { ok: true, kind: "user", user } : { ok: false };
    },
  };
}
