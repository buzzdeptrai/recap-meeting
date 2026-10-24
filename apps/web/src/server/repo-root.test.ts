import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findRepoRoot, resolveDbPath } from "./repo-root";

const webDir = resolve(import.meta.dirname, "../..");
const root = resolve(webDir, "../..");

describe("repo root", () => {
  it("finds the monorepo root from apps/web", () => {
    expect(findRepoRoot(webDir)).toBe(root);
  });

  it("resolves a relative DB_PATH against the root, not the cwd", () => {
    expect(resolveDbPath({ DB_PATH: "./data/x.db" }, webDir)).toBe(resolve(root, "data/x.db"));
    expect(resolveDbPath({}, webDir)).toBe(resolve(root, "data/recap.db"));
  });

  it("keeps absolute paths", () => {
    expect(resolveDbPath({ DB_PATH: "/tmp/a.db" }, webDir)).toBe("/tmp/a.db");
  });
});
