/**
 * PM2 ecosystem: two long-running Node processes on ONE Linux VPS (see docs/DEPLOY.md).
 *
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 reload ecosystem.config.cjs --env production   (after git pull + npm ci + npm run build)
 *
 * Secrets are NOT set here. Both processes read the root .env (realtime via dotenv in
 * @recap/core/node, web via loadEnvConfig in apps/web/next.config.ts) or the process manager's own
 * environment. NEXT_PUBLIC_REALTIME_URL is baked in at `npm run build` time, not at start.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- PM2 loads this file as CommonJS
const path = require("node:path");

const ROOT = __dirname;
const LOGS = path.join(ROOT, "logs");

/** Settings shared by both apps. */
const common = {
  cwd: ROOT,
  // Exactly ONE instance per app, fork mode (never cluster):
  //  - realtime keeps meeting sessions, sockets and the minutes worker in memory, and its startup
  //    recovery assumes a single process per SQLite file (a second one would fail the first
  //    one's running minutes);
  //  - web keeps the login rate limiter in memory.
  instances: 1,
  exec_mode: "fork",
  watch: false,
  autorestart: true,
  // Crash loop protection: a start counts as successful after 10 s; exponential delay, then give up.
  min_uptime: "10s",
  max_restarts: 10,
  exp_backoff_restart_delay: 1000,
  time: true,
  merge_logs: true,
};

module.exports = {
  apps: [
    {
      ...common,
      name: "recap-web",
      // Next production server (the build lives in apps/web/.next). Bound to loopback; the reverse
      // proxy is the only public entry. PORT comes from env (next start reads it).
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1",
      cwd: path.join(ROOT, "apps", "web"),
      max_memory_restart: "600M",
      // Next stops accepting connections and drains on SIGTERM.
      kill_timeout: 5000,
      out_file: path.join(LOGS, "web-out.log"),
      error_file: path.join(LOGS, "web-error.log"),
      env: { NODE_ENV: "production" },
      env_production: { NODE_ENV: "production", PORT: 3000 },
    },
    {
      ...common,
      name: "recap-realtime",
      // Run the TypeScript source with tsx (runtime dependency of apps/realtime).
      script: "node_modules/tsx/dist/cli.mjs",
      args: "apps/realtime/src/server.ts",
      max_memory_restart: "500M",
      // apps/realtime/src/server.ts force-exits 5 s after SIGTERM (SHUTDOWN_TIMEOUT_MS); keep
      // PM2's SIGKILL just above it so the minutes worker can fail in-flight runs cleanly.
      kill_timeout: 8000,
      out_file: path.join(LOGS, "realtime-out.log"),
      error_file: path.join(LOGS, "realtime-error.log"),
      // NODE_ENV=production matters here: AUTH_SECRET is mandatory in production.
      env: { NODE_ENV: "production" },
      // REALTIME_HOST: loopback only, Caddy proxies /ws* to 127.0.0.1:4001.
      env_production: { NODE_ENV: "production", REALTIME_PORT: 4001, REALTIME_HOST: "127.0.0.1" },
    },
  ],
};
