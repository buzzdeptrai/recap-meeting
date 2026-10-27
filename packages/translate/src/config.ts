import { z } from "zod";
import { DEFAULT_BREAKER_CONFIG, type BreakerConfig } from "./circuit-breaker";
import { DEFAULT_CONTEXT_SIZE } from "./context";
import { DEFAULT_MAX_GLOSSARY_TERMS } from "./glossary";

export const PROVIDER_NAMES = ["gemini", "openai"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_ORDER = "openai,gemini";
const DEFAULT_DEADLINE_MS = 3_000;
// Fallbacks answer after the primary already failed, so they get a little longer than a healthy answer.
const DEFAULT_FALLBACK_DEADLINE_MS = 4_000;
const DEFAULT_SLOW_DEADLINE_MS = 0; // disabled for live use: a retry can delay a subtitle ~9 s
const DEFAULT_ORDER_TIMEOUT_MS = 10_000;

export interface TranslatorConfig {
  providerOrder: ProviderName[];
  /** Deadline of the primary provider (first in `providerOrder`) on the first pass. */
  deadlineMs: number;
  /** Deadline of every fallback provider (2nd and later) on the first pass; they can be slower. */
  fallbackDeadlineMs: number;
  /** Deadline of the retry for providers that only timed out; 0 (default) disables it. */
  slowDeadlineMs: number;
  /** Max time a finished seq waits for earlier seqs before being released anyway. */
  orderTimeoutMs: number;
  gemini: { apiKey?: string; model: string };
  openai: { apiKey?: string; model: string };
  breaker: BreakerConfig;
  glossaryMaxTerms: number;
  contextSize: number;
}

export const DEFAULT_TRANSLATOR_CONFIG: Omit<TranslatorConfig, "gemini" | "openai"> = {
  providerOrder: ["openai", "gemini"],
  deadlineMs: DEFAULT_DEADLINE_MS,
  fallbackDeadlineMs: DEFAULT_FALLBACK_DEADLINE_MS,
  slowDeadlineMs: DEFAULT_SLOW_DEADLINE_MS,
  orderTimeoutMs: DEFAULT_ORDER_TIMEOUT_MS,
  breaker: DEFAULT_BREAKER_CONFIG,
  glossaryMaxTerms: DEFAULT_MAX_GLOSSARY_TERMS,
  contextSize: DEFAULT_CONTEXT_SIZE,
};

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const text = () => z.preprocess(blankToUndefined, z.string().trim().optional());
const textWithDefault = (def: string) =>
  z.preprocess(blankToUndefined, z.string().trim().default(def));
const ms = (def: number, min: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().min(min).default(def));

const providerList = z
  .preprocess(
    blankToUndefined,
    z
      .string()
      .default(DEFAULT_ORDER)
      .transform((s) => [
        ...new Set(
          s
            .split(",")
            .map((p) => p.trim().toLowerCase())
            .filter(Boolean),
        ),
      ]),
  )
  .pipe(z.array(z.enum(PROVIDER_NAMES)).min(1));

const envSchema = z
  .object({
    GEMINI_API_KEY: text(),
    OPENAI_API_KEY: text(),
    GEMINI_MODEL: textWithDefault(DEFAULT_GEMINI_MODEL),
    OPENAI_TRANSLATE_MODEL: textWithDefault(DEFAULT_OPENAI_MODEL),
    TRANSLATE_PROVIDER_ORDER: providerList,
    TRANSLATE_DEADLINE_MS: ms(DEFAULT_DEADLINE_MS, 1),
    TRANSLATE_FALLBACK_DEADLINE_MS: ms(DEFAULT_FALLBACK_DEADLINE_MS, 1),
    TRANSLATE_SLOW_DEADLINE_MS: ms(DEFAULT_SLOW_DEADLINE_MS, 0),
    TRANSLATE_ORDER_TIMEOUT_MS: ms(DEFAULT_ORDER_TIMEOUT_MS, 1),
  })
  .superRefine((env, ctx) => {
    const keyVars = { gemini: "GEMINI_API_KEY", openai: "OPENAI_API_KEY" } as const;
    const keys = { gemini: env.GEMINI_API_KEY, openai: env.OPENAI_API_KEY };
    for (const name of env.TRANSLATE_PROVIDER_ORDER) {
      if (keys[name]) continue;
      ctx.addIssue({
        code: "custom",
        path: [keyVars[name]],
        message: `${keyVars[name]} is required because "${name}" is in TRANSLATE_PROVIDER_ORDER`,
      });
    }
  });

export class TranslateConfigError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid translation config: ${issues.join("; ")}`);
    this.name = "TranslateConfigError";
  }
}

/** Builds a TranslatorConfig from process.env-like input. Error messages never contain values. */
export function configFromEnv(env: Record<string, string | undefined>): TranslatorConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new TranslateConfigError(
      parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`),
    );
  }
  const e = parsed.data;
  return {
    ...DEFAULT_TRANSLATOR_CONFIG,
    providerOrder: e.TRANSLATE_PROVIDER_ORDER,
    deadlineMs: e.TRANSLATE_DEADLINE_MS,
    fallbackDeadlineMs: e.TRANSLATE_FALLBACK_DEADLINE_MS,
    slowDeadlineMs: e.TRANSLATE_SLOW_DEADLINE_MS,
    orderTimeoutMs: e.TRANSLATE_ORDER_TIMEOUT_MS,
    gemini: { apiKey: e.GEMINI_API_KEY, model: e.GEMINI_MODEL },
    openai: { apiKey: e.OPENAI_API_KEY, model: e.OPENAI_TRANSLATE_MODEL },
  };
}
