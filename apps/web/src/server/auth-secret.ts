import { resolve } from "node:path";
import { resolveAuthSecret } from "@recap/auth";
import { findRepoRoot } from "./repo-root";

const AUTH_SECRET_FILE = "data/.auth-secret";

/** Absolute path of the dev secret file (shared with the realtime server and the CLI). */
export const authSecretPath = (): string => resolve(findRepoRoot(process.cwd()), AUTH_SECRET_FILE);

/** No database import on purpose: `proxy.ts` uses this too. */
export const getAuthSecret = (): string => resolveAuthSecret({ filePath: authSecretPath() });
