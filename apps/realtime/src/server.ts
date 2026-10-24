import { createRealtimeServer } from "./app";
import { createUpgradeAuth } from "./auth";
import { createRealtimeDeps } from "./deps";
import { EnvError, loadEnv } from "./env";

/** Force exit if graceful shutdown hangs. */
const SHUTDOWN_TIMEOUT_MS = 5_000;
const EXIT_FAILURE = 1;

function loadEnvOrExit() {
  try {
    return loadEnv();
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    console.error(`[realtime] ${error.message}`);
    process.exit(EXIT_FAILURE);
  }
}

async function main(): Promise<void> {
  const env = loadEnvOrExit();
  const deps = createRealtimeDeps(env);
  const server = createRealtimeServer(deps, {
    allowedOrigins: env.REALTIME_ALLOWED_ORIGINS,
    authenticator: createUpgradeAuth(deps.repos, env.RECAP_SERVICE_TOKEN),
  });
  const port = await server.listen(env.REALTIME_PORT);
  console.log(`[realtime] listening on http://localhost:${port} (ws path /ws)`);

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[realtime] ${signal} received, shutting down`);
    setTimeout(() => process.exit(EXIT_FAILURE), SHUTDOWN_TIMEOUT_MS).unref();
    server.close().then(
      () => {
        deps.close?.();
        process.exit(0);
      },
      (error: unknown) => {
        console.error("[realtime] error during shutdown:", error);
        process.exit(EXIT_FAILURE);
      },
    );
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Log and crash: an unknown state is worse than a restart. Never swallow these.
process.on("uncaughtException", (error) => {
  console.error("[realtime] uncaught exception:", error);
  process.exit(EXIT_FAILURE);
});
process.on("unhandledRejection", (reason) => {
  console.error("[realtime] unhandled rejection:", reason);
  process.exit(EXIT_FAILURE);
});

void main();
