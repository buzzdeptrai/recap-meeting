import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/realtime", "apps/web", "tools/*"],
    passWithNoTests: true,
  },
});
