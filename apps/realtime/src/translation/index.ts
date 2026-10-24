import type { UsageEventInput, UsageSink, UsageVendor } from "@recap/core";
import type { Repositories } from "@recap/db";
import {
  configFromEnv,
  createTranslator,
  type Translator,
  type TranslationUsageEvent,
} from "@recap/translate";
import type { Env } from "../env";
import type { MeetingSession } from "../session/meeting-session";
import type { SessionHooks } from "../session/types";
import { createGlossarySource } from "./glossary-adapter";
import { createSessionTranslation } from "./session-translation";

export { createGlossarySource } from "./glossary-adapter";
export { resolveDirection } from "./direction";
export { createSessionTranslation } from "./session-translation";

/** Real translator (providers/keys from env, glossary from the database). */
export function createTranslatorFromEnv(
  env: Env,
  repos: Repositories,
  usage?: UsageSink,
): Translator {
  return createTranslator(configFromEnv({ ...process.env, ...envOverrides(env) }), {
    glossary: createGlossarySource(repos),
    onUsage: usage && ((event) => usage(toUsageEvent(event))),
  });
}

/** Values already validated by the realtime env loader win over raw process.env. */
function envOverrides(env: Env): Record<string, string> {
  return {
    GEMINI_API_KEY: env.GEMINI_API_KEY,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    GEMINI_MODEL: env.GEMINI_MODEL,
    OPENAI_TRANSLATE_MODEL: env.OPENAI_TRANSLATE_MODEL,
    TRANSLATE_PROVIDER_ORDER: env.TRANSLATE_PROVIDER_ORDER.join(","),
    TRANSLATE_DEADLINE_MS: String(env.TRANSLATE_DEADLINE_MS),
  };
}

/** `deps.onSessionCreated` implementation: one hook set per session sharing one translator. */
export function createTranslationHook(
  translator: Translator,
): (session: MeetingSession) => SessionHooks {
  return () => createSessionTranslation(translator);
}

/** Maps a provider attempt to a usage row (provider names are vendor names). */
export function toUsageEvent(event: TranslationUsageEvent): UsageEventInput {
  return {
    meetingId: event.meetingId ?? null,
    vendor: event.provider as UsageVendor,
    service: "translate",
    model: event.model,
    inputTokens: event.inputTokens,
    outputTokens: event.outputTokens,
    latencyMs: event.latencyMs,
    status: event.status,
    meta: event.errorCode ? { errorCode: event.errorCode } : null,
  };
}
