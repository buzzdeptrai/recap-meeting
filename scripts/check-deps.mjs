#!/usr/bin/env node
/**
 * Verifies that every bare import in each workspace is declared in that workspace's package.json.
 * Test files and tool configs may also rely on the root devDependencies (vitest, typescript, ...).
 * Usage: node scripts/check-deps.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_GROUPS = ["apps", "packages", "tools"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "coverage"]);
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?)$/;
const TEST_FILE = /(?:^|\/)test\/|\.test\.[cm]?[jt]sx?$/;
// import x from "a"; export ... from "a"; import("a"); require("a"); import "a"
const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm;
const BUILTINS = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function packageName(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

const PACKAGE_SPECIFIER = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+(?:\/.*)?$/i;

function isExternal(specifier) {
  if (!PACKAGE_SPECIFIER.test(specifier)) return false;
  if (specifier.startsWith(".") || specifier.startsWith("/")) return false;
  if (specifier.startsWith("node:") || BUILTINS.has(specifier)) return false;
  return !specifier.startsWith("@/") && !specifier.startsWith("~/");
}

function* walk(dir, topLevelOnly = false) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!topLevelOnly) yield* walk(full);
    } else if (SOURCE_EXT.test(entry)) {
      yield full;
    }
  }
}

function declaredIn(pkg) {
  return new Set(
    ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"].flatMap((key) =>
      Object.keys(pkg[key] ?? {}),
    ),
  );
}

function checkWorkspace(dir, pkg, rootDeclared, files) {
  const own = declaredIn(pkg);
  const problems = [];
  for (const file of files) {
    const rel = relative(dir, file);
    const allowRoot = TEST_FILE.test(rel) || !rel.includes("/");
    for (const match of readFileSync(file, "utf8").matchAll(SPECIFIER)) {
      if (!isExternal(match[1])) continue;
      const name = packageName(match[1]);
      if (name === pkg.name || own.has(name) || (allowRoot && rootDeclared.has(name))) continue;
      problems.push(`${pkg.name}: ${relative(ROOT, file)} imports "${name}" (not declared)`);
    }
  }
  return problems;
}

function main() {
  const rootPkg = readJson(join(ROOT, "package.json"));
  const rootDeclared = declaredIn(rootPkg);
  const problems = checkWorkspace(ROOT, rootPkg, new Set(), walk(ROOT, true));
  for (const group of WORKSPACE_GROUPS) {
    for (const name of readdirSync(join(ROOT, group))) {
      const dir = join(ROOT, group, name);
      if (!existsSync(join(dir, "package.json"))) continue;
      problems.push(
        ...checkWorkspace(dir, readJson(join(dir, "package.json")), rootDeclared, walk(dir)),
      );
    }
  }
  if (problems.length > 0) {
    console.error([...new Set(problems)].join("\n"));
    process.exit(1);
  }
  console.log("check:deps OK - every import is declared in its workspace package.json");
}

main();
