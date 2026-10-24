import { MARK_WINDOW_AFTER_MS, MARK_WINDOW_BEFORE_MS } from "@recap/core";
import { z } from "zod";
import { MinutesError } from "./errors";
import type { GeneratorConfig } from "./types";

const DEFAULT_MODEL = "gpt-4.1";
const DEFAULT_DEADLINE_MS = 120_000;
const MIN_WINDOW_BEFORE_MS = 5_000;
const MAX_WINDOW_BEFORE_MS = 300_000;
const MAX_WINDOW_AFTER_MS = 60_000;
const SINGLE_PASS_MAX_TOKENS = 12_000;
const CHUNK_TOKENS = 8_000;
const MAX_GLOSSARY_TERMS = 100;

export const DEFAULT_GENERATOR_CONFIG: GeneratorConfig = {
  singlePassMaxTokens: SINGLE_PASS_MAX_TOKENS,
  chunkTokens: CHUNK_TOKENS,
  markWindowBeforeMs: MARK_WINDOW_BEFORE_MS,
  markWindowAfterMs: MARK_WINDOW_AFTER_MS,
  maxGlossaryTerms: MAX_GLOSSARY_TERMS,
};

export interface OpenAiMinutesConfig {
  apiKey: string;
  model: string;
  deadlineMs: number;
}

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const envSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1, "OPENAI_API_KEY is required"),
  OPENAI_MINUTES_MODEL: z.preprocess(blankToUndefined, z.string().trim().default(DEFAULT_MODEL)),
  OPENAI_MINUTES_DEADLINE_MS: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(1).default(DEFAULT_DEADLINE_MS),
  ),
  MINUTES_MARK_WINDOW_BEFORE_MS: z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int()
      .min(MIN_WINDOW_BEFORE_MS)
      .max(MAX_WINDOW_BEFORE_MS)
      .default(MARK_WINDOW_BEFORE_MS),
  ),
  MINUTES_MARK_WINDOW_AFTER_MS: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(0).max(MAX_WINDOW_AFTER_MS).default(MARK_WINDOW_AFTER_MS),
  ),
});

function parseEnv<T extends z.ZodType>(
  env: Record<string, string | undefined>,
  schema: T,
): z.output<T> {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`);
    throw new MinutesError(`Invalid minutes config: ${issues.join("; ")}`, "CONFIG");
  }
  return parsed.data;
}

/** Generator settings from env (mark window); does not need the API key. */
export function generatorConfigFromEnv(
  env: Record<string, string | undefined>,
): Pick<GeneratorConfig, "markWindowBeforeMs" | "markWindowAfterMs"> {
  const e = parseEnv(env, envSchema.partial({ OPENAI_API_KEY: true }));
  return {
    markWindowBeforeMs: e.MINUTES_MARK_WINDOW_BEFORE_MS,
    markWindowAfterMs: e.MINUTES_MARK_WINDOW_AFTER_MS,
  };
}

/** The configured minutes model (no API key needed); null when the env is invalid. */
export function minutesModelFromEnv(env: Record<string, string | undefined>): string | null {
  const parsed = envSchema.partial({ OPENAI_API_KEY: true }).safeParse(env);
  return parsed.success ? parsed.data.OPENAI_MINUTES_MODEL : null;
}

/** Builds the OpenAI minutes config from process.env-like input. Errors never contain values. */
export function minutesConfigFromEnv(env: Record<string, string | undefined>): OpenAiMinutesConfig {
  const e = parseEnv(env, envSchema);
  return {
    apiKey: e.OPENAI_API_KEY,
    model: e.OPENAI_MINUTES_MODEL,
    deadlineMs: e.OPENAI_MINUTES_DEADLINE_MS,
  };
}
