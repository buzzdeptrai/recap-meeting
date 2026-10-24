import { loadEnvConfig } from "@next/env";
import { OpenAiMinutesLlm, minutesConfigFromEnv, type MinutesLlm } from "@recap/minutes";
import { findRepoRoot } from "./repo-root";
import { getUsageSink, usageContext } from "./usage-recorder";
import { ServiceError } from "./service-error";

const globalForLlm = globalThis as typeof globalThis & { __recapMinutesLlm?: MinutesLlm };

/** Server-only. The OpenAI client is built lazily so a missing key only fails minutes routes. */
export function getMinutesLlm(): MinutesLlm {
  if (globalForLlm.__recapMinutesLlm) return globalForLlm.__recapMinutesLlm;
  try {
    // The Next server worker does not always inherit the root .env that next.config loaded.
    loadEnvConfig(findRepoRoot(process.cwd()), process.env.NODE_ENV !== "production", {
      info: () => {},
      error: () => {},
    });
    globalForLlm.__recapMinutesLlm = new OpenAiMinutesLlm(
      minutesConfigFromEnv(process.env),
      undefined,
      (event) =>
        getUsageSink()({
          meetingId: usageContext.getStore()?.meetingId ?? null,
          vendor: "openai",
          service: "minutes",
          model: event.model,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          latencyMs: event.latencyMs,
          status: event.status,
        }),
    );
  } catch (error) {
    console.error("[minutes] OpenAI config error:", error instanceof Error ? error.message : error);
    throw new ServiceError(
      503,
      "MINUTES_UNAVAILABLE",
      "Chưa cấu hình dịch vụ tạo biên bản (OPENAI_API_KEY).",
    );
  }
  return globalForLlm.__recapMinutesLlm;
}
