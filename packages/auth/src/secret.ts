import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { GENERATED_SECRET_BYTES, MIN_SECRET_LENGTH } from "./constants";

export interface SecretOptions {
  env?: Record<string, string | undefined>;
  /** Where the development secret is persisted (shared by web, realtime and CLI). */
  filePath: string;
  warn?: (message: string) => void;
  random?: (size: number) => Buffer;
}

const cache = new Map<string, string>();

function readIfPresent(path: string): string | null {
  try {
    const value = readFileSync(path, "utf8").trim();
    return value.length >= MIN_SECRET_LENGTH ? value : null;
  } catch {
    return null;
  }
}

/** Creates the file only if absent (`wx`), so concurrent processes agree on one secret. */
function createSecretFile(path: string, random: (size: number) => Buffer): string {
  const secret = random(GENERATED_SECRET_BYTES).toString("base64url");
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(path, `${secret}\n`, { flag: "wx", mode: 0o600 });
    return secret;
  } catch {
    const existing = readIfPresent(path);
    if (existing) return existing;
    throw new Error("Cannot create the development auth secret file.");
  }
}

/**
 * `AUTH_SECRET` wins. Without it: production refuses to start; development generates a random
 * secret once and persists it (mode 0600) so sessions survive restarts.
 */
export function resolveAuthSecret(options: SecretOptions): string {
  const env = options.env ?? process.env;
  const configured = env.AUTH_SECRET?.trim();
  if (configured) {
    if (configured.length < MIN_SECRET_LENGTH) {
      throw new Error(`AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
    }
    return configured;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production (set it in .env).");
  }
  const cached = cache.get(options.filePath);
  if (cached) return cached;
  const existing = readIfPresent(options.filePath);
  const secret = existing ?? createSecretFile(options.filePath, options.random ?? randomBytes);
  if (!existing) {
    (options.warn ?? console.warn)(
      "[auth] AUTH_SECRET is not set; generated a development secret in data/.auth-secret.",
    );
  }
  cache.set(options.filePath, secret);
  return secret;
}

/** Test helper. */
export const clearSecretCache = (): void => cache.clear();
