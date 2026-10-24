import { REPO_ROOT, loadRootEnv, resolveFromRoot } from "@recap/core/node";
import { z } from "zod";
import { parseAllowedOrigins } from "./origin";

export { REPO_ROOT };

const DEFAULT_PORT = 4001;
const DEFAULT_TRANSLATE_DEADLINE_MS = 1500;
const MAX_PORT = 65_535;
const MIN_SERVICE_TOKEN_LENGTH = 16;

/** AssemblyAI clamps min_turn_silence to 50..10000 ms (docs); the max bound is our own sanity cap. */
const MIN_TURN_SILENCE_RANGE = { min: 50, max: 10_000 };
const MAX_TURN_SILENCE_RANGE = { min: 50, max: 30_000 };

const optionalMs = (range: { min: number; max: number }) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().min(range.min).max(range.max).optional(),
  );

const requiredKey = z.string().trim().min(1, "is required");
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const envSchema = z.object({
  STT_PROVIDER: z.enum(["deepgram", "assemblyai"]).default("deepgram"),
  /** Required only when STT_PROVIDER=deepgram (checked below). */
  DEEPGRAM_API_KEY: optionalString,
  OPENAI_API_KEY: requiredKey,
  GEMINI_API_KEY: requiredKey,
  /** Required only when STT_PROVIDER=assemblyai (checked below). */
  ASSEMBLYAI_API_KEY: optionalString,
  ASSEMBLYAI_MODEL: z.string().trim().min(1).default("universal-3-6-pro"),
  /** Unset = language default in @recap/stt (vi/multi 1200/3500, en 800/2500). */
  ASSEMBLYAI_MIN_TURN_SILENCE_MS: optionalMs(MIN_TURN_SILENCE_RANGE),
  ASSEMBLYAI_MAX_TURN_SILENCE_MS: optionalMs(MAX_TURN_SILENCE_RANGE),
  /** Optional bearer token that lets tools (stream-file) open the WebSocket without a login. */
  RECAP_SERVICE_TOKEN: optionalString.refine(
    (value) => value === undefined || value.length >= MIN_SERVICE_TOKEN_LENGTH,
    `must be at least ${MIN_SERVICE_TOKEN_LENGTH} characters`,
  ),
  DEEPGRAM_MODEL: z.string().trim().min(1).default("nova-3"),
  DEEPGRAM_LANGUAGE: z.enum(["vi", "en", "multi"]).default("multi"),
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-3.1-flash-lite"),
  OPENAI_TRANSLATE_MODEL: z.string().trim().min(1).default("gpt-4.1-mini"),
  TRANSLATE_PROVIDER_ORDER: z
    .string()
    .default("gemini,openai")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  TRANSLATE_DEADLINE_MS: z.coerce.number().int().positive().default(DEFAULT_TRANSLATE_DEADLINE_MS),
  REALTIME_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((value) => parseAllowedOrigins(value)),
  REALTIME_PORT: z.coerce.number().int().min(0).max(MAX_PORT).default(DEFAULT_PORT),
  DB_PATH: z.string().trim().min(1).default("./data/recap.db"),
  AUDIO_DIR: z.string().trim().min(1).default("./data/audio"),
});

const STT_KEY_NAME = {
  deepgram: "DEEPGRAM_API_KEY",
  assemblyai: "ASSEMBLYAI_API_KEY",
} as const;

export type Env = Omit<z.infer<typeof envSchema>, "DB_PATH" | "AUDIO_DIR"> & {
  /** Absolute path (relative values resolve against the repo root, not the cwd). */
  DB_PATH: string;
  /** Absolute path (relative values resolve against the repo root, not the cwd). */
  AUDIO_DIR: string;
};

export class EnvError extends Error {
  override name = "EnvError";
}

/** Variable names and reasons only — never values, which may be secrets. */
function describeIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
}

/** Missing-key line for the selected STT vendor (the other vendor's key stays optional). */
function missingSttKeyIssue(source: Record<string, string | undefined>): string[] {
  const provider = source.STT_PROVIDER?.trim() || "deepgram";
  if (provider !== "deepgram" && provider !== "assemblyai") return [];
  const name = STT_KEY_NAME[provider];
  if (source[name]?.trim()) return [];
  return [`  - ${name}: is required when STT_PROVIDER=${provider}`];
}

/** Validates a raw env map. Pure, so it can be tested without touching process.env. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  const problems = [
    ...(result.success ? [] : [describeIssues(result.error)]),
    ...missingSttKeyIssue(source),
  ];
  if (!result.success || problems.length > 0) {
    throw new EnvError(
      `Invalid environment configuration (see .env.example at the repo root):\n${problems.join("\n")}`,
    );
  }
  const env = result.data;
  const { ASSEMBLYAI_MIN_TURN_SILENCE_MS: minSilence, ASSEMBLYAI_MAX_TURN_SILENCE_MS: maxSilence } =
    env;
  if (minSilence !== undefined && maxSilence !== undefined && maxSilence < minSilence) {
    throw new EnvError(
      "Invalid environment configuration (see .env.example at the repo root):\n  - ASSEMBLYAI_MAX_TURN_SILENCE_MS: must be >= ASSEMBLYAI_MIN_TURN_SILENCE_MS",
    );
  }
  return {
    ...env,
    DB_PATH: resolveFromRoot(env.DB_PATH),
    AUDIO_DIR: resolveFromRoot(env.AUDIO_DIR),
  };
}

/** Loads `<repo>/.env` into process.env (existing vars win) and validates it. */
export function loadEnv(): Env {
  loadRootEnv();
  return parseEnv(process.env);
}
