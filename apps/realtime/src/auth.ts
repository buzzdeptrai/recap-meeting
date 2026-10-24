import {
  AuthService,
  createUpgradeAuthenticator,
  resolveAuthSecret,
  type UpgradeAuthenticator,
} from "@recap/auth";
import { resolveFromRoot } from "@recap/core/node";
import type { Repositories } from "@recap/db";

const AUTH_SECRET_FILE = "data/.auth-secret";

/**
 * Same secret as the web app (AUTH_SECRET, or the shared dev file) and the same SQLite
 * `sessions` table, so a cookie issued by the web app is valid here.
 */
export function createUpgradeAuth(
  repos: Repositories,
  serviceToken: string | undefined,
): UpgradeAuthenticator {
  const secret = resolveAuthSecret({ filePath: resolveFromRoot(AUTH_SECRET_FILE) });
  return createUpgradeAuthenticator(new AuthService({ repos, secret }), serviceToken);
}
