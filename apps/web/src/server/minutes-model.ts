import { loadEnvConfig } from "@next/env";
import { MinutesError, minutesConfigFromEnv, minutesModelFromEnv } from "@recap/minutes";
import { findRepoRoot } from "./repo-root";
import { ServiceError } from "./service-error";

function loadRootEnv() {
  // The Next server worker does not always inherit the root .env that next.config loaded.
  loadEnvConfig(findRepoRoot(process.cwd()), process.env.NODE_ENV !== "production", {
    info: () => {},
    error: () => {},
  });
}

/** Server-only. The model generation would use now, or null when it cannot be told. */
export function currentMinutesModel(): string | null {
  try {
    loadRootEnv();
    return minutesModelFromEnv(process.env);
  } catch {
    return null;
  }
}

/**
 * Server-only. The model a new run is stamped with. Fails with 503 when the minutes service is not
 * configured, so the user hears it at once instead of from a failed background run. The model call
 * itself happens in the realtime worker, never in this process.
 */
export function requireMinutesModel(): string {
  try {
    loadRootEnv();
    return minutesConfigFromEnv(process.env).model;
  } catch (error) {
    if (!(error instanceof MinutesError)) throw error;
    console.error("[minutes] OpenAI config error:", error.message);
    throw new ServiceError(
      503,
      "MINUTES_UNAVAILABLE",
      "Chưa cấu hình dịch vụ tạo biên bản (OPENAI_API_KEY).",
    );
  }
}
