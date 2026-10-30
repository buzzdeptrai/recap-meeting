import { createRealtimeServer } from "./app";
import { recoverInterruptedMeetings } from "./boot-recovery";
import { createUpgradeAuth } from "./auth";
import { createRealtimeDeps } from "./deps";
import { EnvError, loadEnv } from "./env";
import type { SessionRegistry } from "./session/registry";

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
  registryForCrashLog = deps.registry;
  recoverInterruptedMeetings(deps.repos, deps.audioDir);
  const server = createRealtimeServer(deps, {
    allowedOrigins: env.REALTIME_ALLOWED_ORIGINS,
    maxConnections: env.REALTIME_MAX_CONNECTIONS,
    authenticator: createUpgradeAuth(deps.repos, env.RECAP_SERVICE_TOKEN),
  });
  const port = await server.listen(env.REALTIME_PORT, env.REALTIME_HOST);
  deps.minutesWorker?.start();
  console.log(
    `[realtime] listening on http://${env.REALTIME_HOST ?? "localhost"}:${port} (bind ${env.REALTIME_HOST ?? "all interfaces"}, ws path /ws)`,
  );

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[realtime] ${signal} received, shutting down`);
    setTimeout(() => process.exit(EXIT_FAILURE), SHUTDOWN_TIMEOUT_MS).unref();
    const stopWorker = deps.minutesWorker?.stop() ?? Promise.resolve();
    stopWorker
      .then(() => server.close())
      .then(
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

let registryForCrashLog: SessionRegistry | undefined;

/** Which meetings were live when the process died (ids only), to correlate with session logs. */
function crashContext(): string {
  const ids = registryForCrashLog?.activeMeetingIds() ?? [];
  return `${ids.length} active session(s): ${ids.join(", ") || "none"}`;
}

// Last resort only: errors inside a meeting session are caught per session (see
// MeetingSession.fail), so reaching these means a bug outside any session. An unknown state is
// worse than a restart, so log with context and exit; boot recovery then ends interrupted meetings.
process.on("uncaughtException", (error) => {
  console.error(`[realtime] uncaught exception (${crashContext()}):`, error);
  process.exit(EXIT_FAILURE);
});
process.on("unhandledRejection", (reason) => {
  console.error(`[realtime] unhandled rejection (${crashContext()}):`, reason);
  process.exit(EXIT_FAILURE);
});

void main();
