import { readFileSync } from "node:fs";
import { pricingSchema, type Pricing } from "../usage";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

/** Repo root: packages/core/src/node → ../../../.. (Node-only; import via `@recap/core/node`). */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** Relative paths resolve against the repo root, never the cwd (`npm -w` sets cwd to the workspace). */
export const resolveFromRoot = (path: string): string =>
  isAbsolute(path) ? path : resolve(REPO_ROOT, path);

/** Loads `<repo>/.env` into process.env (existing vars win). Never logs values. */
export function loadRootEnv(): void {
  loadDotenv({ path: resolve(REPO_ROOT, ".env"), quiet: true });
}

const DEFAULT_DB_PATH = "./data/recap.db";

/** Absolute SQLite path from `DB_PATH` (default `./data/recap.db`), resolved against the repo root. */
export const dbPathFromEnv = (env: Record<string, string | undefined> = process.env): string =>
  resolveFromRoot(env.DB_PATH?.trim() || DEFAULT_DB_PATH);

/** Reads and validates a pricing file (default `<repo>/config/pricing.json`). Throws on bad data. */
export function loadPricingFile(path: string = resolveFromRoot("config/pricing.json")): Pricing {
  return pricingSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}
