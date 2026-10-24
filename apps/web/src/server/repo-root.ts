import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const DEFAULT_DB_PATH = "./data/recap.db";

/** Walks up from `start` to the monorepo root (the directory that holds `packages/db`). */
export function findRepoRoot(start: string): string {
  let current = resolve(start);
  for (;;) {
    if (existsSync(join(current, "packages", "db"))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

/** DB_PATH relative values resolve against the repo root, never the cwd (npm -w sets cwd=apps/web). */
export function resolveDbPath(
  env: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd(),
): string {
  const raw = env.DB_PATH?.trim() || DEFAULT_DB_PATH;
  return isAbsolute(raw) ? raw : resolve(findRepoRoot(cwd), raw);
}
