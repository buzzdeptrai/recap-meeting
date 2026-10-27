import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// The single .env lives at the repo root; load it so NEXT_PUBLIC_* and DB_PATH are visible here.
loadEnvConfig(resolve(process.cwd(), "../.."), process.env.NODE_ENV !== "production", {
  info: () => {},
  error: console.error,
});

/** Private app: tell every crawler not to index, follow, cache or snippet anything (incl. JS chunks). */
const NO_INDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex";

const nextConfig: NextConfig = {
  // A second dev instance (QA against a scratch DB) needs its own build dir and lock.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Workspace packages ship TypeScript source (no build step).
  transpilePackages: [
    "@recap/admin-ui",
    "@recap/auth",
    "@recap/core",
    "@recap/db",
    "@recap/export",
    "@recap/minutes",
  ],
  // Native module: load from node_modules at runtime instead of bundling.
  serverExternalPackages: ["better-sqlite3"],
  // Never ship source maps to the browser (the default, pinned so nobody flips it by accident).
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: NO_INDEX }] }];
  },
};

export default nextConfig;
