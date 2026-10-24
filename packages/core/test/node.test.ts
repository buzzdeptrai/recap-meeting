import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, dbPathFromEnv, resolveFromRoot } from "../src/node";

describe("@recap/core/node", () => {
  it("points REPO_ROOT at the monorepo root", () => {
    expect(existsSync(join(REPO_ROOT, "packages", "core"))).toBe(true);
  });

  it("resolves relative paths against the repo root and keeps absolute ones", () => {
    expect(resolveFromRoot("data/x")).toBe(join(REPO_ROOT, "data", "x"));
    expect(resolveFromRoot("/abs/x")).toBe("/abs/x");
  });

  it("builds the db path from env with a default", () => {
    expect(dbPathFromEnv({})).toBe(join(REPO_ROOT, "data", "recap.db"));
    expect(dbPathFromEnv({ DB_PATH: "  " })).toBe(join(REPO_ROOT, "data", "recap.db"));
    expect(isAbsolute(dbPathFromEnv({ DB_PATH: "./x.db" }))).toBe(true);
  });
});
