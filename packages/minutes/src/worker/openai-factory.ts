import { minutesConfigFromEnv, translateConfigFromEnv } from "../config";
import { OpenAiMinutesLlm, type OpenAiClientLike } from "../llm/openai";
import type { LlmFactory } from "./types";

/**
 * Production model factory: an OpenAI client per run, configured from env (the key is read when the
 * run starts, so a missing key fails that run with the curated CONFIG message, not the worker).
 * `client` is injectable for tests.
 */
export function createOpenAiLlmFactory(
  env: Record<string, string | undefined>,
  client?: OpenAiClientLike,
): LlmFactory {
  return (onUsage) => new OpenAiMinutesLlm(minutesConfigFromEnv(env), client, onUsage);
}

/** Model factory for the translation step (cheaper model, same key and deadline). */
export function createOpenAiTranslateLlmFactory(
  env: Record<string, string | undefined>,
  client?: OpenAiClientLike,
): LlmFactory {
  return (onUsage) => new OpenAiMinutesLlm(translateConfigFromEnv(env), client, onUsage);
}
