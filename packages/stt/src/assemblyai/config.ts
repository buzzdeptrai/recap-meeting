import { DEFAULT_RECONNECT, type ReconnectConfig } from "../deepgram/config";
import type { SttLanguage } from "../types";

export const ASSEMBLYAI_STREAM_URL = "wss://streaming.assemblyai.com/v3/ws";
export const DEFAULT_ASSEMBLYAI_MODEL = "universal-3-6-pro";

/** Keyterm limits from the AssemblyAI docs: max 100 terms, each at most 50 characters. */
export const MAX_KEYTERMS = 100;
export const MAX_KEYTERM_CHARS = 50;
/** Keyterms travel in the URL query; keep the encoded part well below typical proxy limits. */
export const KEYTERM_URL_CHAR_BUDGET = 4096;

const DEFAULT_MIN_TURN_SILENCE_MS = 800;
const DEFAULT_MAX_TURN_SILENCE_MS = 2_500;
/** Vietnamese-capable languages pause longer inside a sentence (the reference project's slow mode). */
const VI_MIN_TURN_SILENCE_MS = 1_200;
const VI_MAX_TURN_SILENCE_MS = 3_500;
const CLOSE_TIMEOUT_MS = 3_000;
const CONNECT_TIMEOUT_MS = 10_000;
/** Floor for the retry delay after the per-minute session-start limit (starts reset each minute). */
export const RATE_LIMIT_MIN_DELAY_MS = 5_000;

export { DEFAULT_RECONNECT, type ReconnectConfig };

export interface AssemblyAiConfig {
  /** Server-side secret. Sent only as the Authorization header, never logged. */
  apiKey: string;
  model: string;
  /**
   * `vi`/`en` steer the model with `language_codes`; `multi`/`detect` send nothing so the model
   * code-switches natively across all its languages.
   */
  language: SttLanguage;
  keyterms?: readonly string[];
  minTurnSilenceMs?: number;
  maxTurnSilenceMs?: number;
  closeTimeoutMs?: number;
  connectTimeoutMs?: number;
  /** Override for tests / data-residency endpoints. */
  baseUrl?: string;
  reconnect?: Partial<ReconnectConfig>;
  /**
   * Close a channel's socket after this much continuous silence and reopen it on speech.
   * Unset or 0 = never (every frame is streamed, as before).
   */
  idleAfterMs?: number;
  /** Minimum retry delay after the per-minute session-start limit (default 5 s; tests shorten it). */
  rateLimitRetryMs?: number;
}

export const ASSEMBLYAI_DEFAULTS = {
  minTurnSilenceMs: DEFAULT_MIN_TURN_SILENCE_MS,
  maxTurnSilenceMs: DEFAULT_MAX_TURN_SILENCE_MS,
  closeTimeoutMs: CLOSE_TIMEOUT_MS,
  connectTimeoutMs: CONNECT_TIMEOUT_MS,
} as const;

export interface TurnSilence {
  minMs: number;
  maxMs: number;
}

/** Default end-of-turn silences: slow mode for `vi`/`multi`/`detect`, the original pair for `en`. */
export function defaultTurnSilence(language: SttLanguage): TurnSilence {
  if (language === "en") {
    return { minMs: DEFAULT_MIN_TURN_SILENCE_MS, maxMs: DEFAULT_MAX_TURN_SILENCE_MS };
  }
  return { minMs: VI_MIN_TURN_SILENCE_MS, maxMs: VI_MAX_TURN_SILENCE_MS };
}

/** Reconnect delay: the backoff, raised to the rate-limit floor after the per-minute start limit. */
export function retryDelayMs(
  config: AssemblyAiConfig,
  backoffMs: number,
  rateLimited: boolean,
): number {
  if (!rateLimited) return backoffMs;
  return Math.max(backoffMs, config.rateLimitRetryMs ?? RATE_LIMIT_MIN_DELAY_MS);
}
