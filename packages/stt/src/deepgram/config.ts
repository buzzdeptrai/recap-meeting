import type { SttLanguage } from "../types";

export const DEEPGRAM_LISTEN_URL = "wss://api.deepgram.com/v1/listen";

/** Keyterm limits copied from translation-ai (vendor recommends 20-50 terms). */
export const MAX_KEYTERMS = 30;
export const KEYTERM_URL_CHAR_BUDGET = 2048;

const KEEP_ALIVE_INTERVAL_MS = 8_000;
const DEFAULT_ENDPOINTING_MS = 300;
const DEFAULT_UTTERANCE_END_MS = 1_000;
const CLOSE_TIMEOUT_MS = 2_000;
const CONNECT_TIMEOUT_MS = 10_000;

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 15_000;
const RECONNECT_MAX_ATTEMPTS = 8;
/** Audio kept while reconnecting (frames of FRAME_MS each → 30 s). */
const REPLAY_BUFFER_FRAMES = 300;

export interface ReconnectConfig {
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
  /** Frames retained while disconnected and replayed after reconnect. */
  replayBufferFrames: number;
}

export const DEFAULT_RECONNECT: ReconnectConfig = {
  baseDelayMs: RECONNECT_BASE_MS,
  maxDelayMs: RECONNECT_MAX_MS,
  maxAttempts: RECONNECT_MAX_ATTEMPTS,
  replayBufferFrames: REPLAY_BUFFER_FRAMES,
};

export interface DeepgramConfig {
  /** Server-side secret. Sent only as an Authorization header, never logged. */
  apiKey: string;
  model: string;
  language: SttLanguage;
  keyterms?: readonly string[];
  endpointingMs?: number;
  utteranceEndMs?: number;
  keepAliveMs?: number;
  closeTimeoutMs?: number;
  connectTimeoutMs?: number;
  /** Override for tests / proxies. */
  baseUrl?: string;
  reconnect?: Partial<ReconnectConfig>;
}

export const DEEPGRAM_DEFAULTS = {
  keepAliveMs: KEEP_ALIVE_INTERVAL_MS,
  endpointingMs: DEFAULT_ENDPOINTING_MS,
  utteranceEndMs: DEFAULT_UTTERANCE_END_MS,
  closeTimeoutMs: CLOSE_TIMEOUT_MS,
  connectTimeoutMs: CONNECT_TIMEOUT_MS,
} as const;
