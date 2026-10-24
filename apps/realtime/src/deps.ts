import { loadPricingFile } from "@recap/core/node";
import type { Pricing, SourceLang, UsageSink } from "@recap/core";
import {
  createRepositories,
  createUsageRecorder,
  openDatabase,
  type Repositories,
} from "@recap/db";
import {
  createSttProvider,
  segmenterConfigForLanguage,
  type SegmenterConfig,
  type SttLanguage,
  type SttProvider,
  type SttProviderConfig,
} from "@recap/stt";
import { EnvError, type Env } from "./env";
import { SessionRegistry } from "./session/registry";
import type { SessionHooks } from "./session/types";
import { createTranslationHook, createTranslatorFromEnv } from "./translation";
import type { MeetingSession } from "./session/meeting-session";

export type SttVendor = Env["STT_PROVIDER"];

export interface SttRequest {
  sourceLang: SourceLang;
  keyterms: string[];
}

/** Everything the WebSocket layer needs; each member is replaceable in tests. */
export interface RealtimeDeps {
  repos: Repositories;
  audioDir: string;
  registry: SessionRegistry;
  createStt: (request: SttRequest) => SttProvider;
  /** Segmenter thresholds for a session's source language; absent = the segmenter default. */
  segmenterConfigFor?: (sourceLang: SourceLang) => SegmenterConfig;
  /**
   * Translation seam (T5): called for every new session before it starts; return hooks that
   * receive each persisted segment and may call `session.emitTranslation(...)`.
   */
  onSessionCreated?: (session: MeetingSession) => SessionHooks | undefined;
  /** Usage metering (T13); absent in tests that do not care. */
  usage?: {
    sink: UsageSink;
    /** Vendor recorded on the usage rows (default deepgram). */
    sttVendor?: SttVendor;
    sttModel: string;
    sttLanguage: SttLanguage;
  };
  /** Releases resources owned by the deps (database). */
  close?: () => void;
}

/** `auto` has no provider equivalent: fall back to the configured default language. */
export function resolveSttLanguage(sourceLang: SourceLang, fallback: SttLanguage): SttLanguage {
  return sourceLang === "auto" ? fallback : sourceLang;
}

function loadPricing(): Pricing {
  try {
    return loadPricingFile();
  } catch (error) {
    console.error("[usage] pricing unavailable:", error instanceof Error ? error.message : "error");
    return { version: 1, currency: "USD", entries: [] };
  }
}

function requireKey(value: string | undefined, name: string): string {
  if (value) return value;
  throw new EnvError(`${name} is required for the selected STT provider (see .env.example)`);
}

/** Builds the STT provider config for the vendor chosen by `STT_PROVIDER`. */
export function buildSttConfig(env: Env, request: SttRequest): SttProviderConfig {
  const language = resolveSttLanguage(request.sourceLang, env.DEEPGRAM_LANGUAGE);
  if (env.STT_PROVIDER === "assemblyai") {
    return {
      provider: "assemblyai",
      apiKey: requireKey(env.ASSEMBLYAI_API_KEY, "ASSEMBLYAI_API_KEY"),
      model: env.ASSEMBLYAI_MODEL,
      language,
      keyterms: request.keyterms,
      minTurnSilenceMs: env.ASSEMBLYAI_MIN_TURN_SILENCE_MS,
      maxTurnSilenceMs: env.ASSEMBLYAI_MAX_TURN_SILENCE_MS,
    };
  }
  return {
    provider: "deepgram",
    apiKey: requireKey(env.DEEPGRAM_API_KEY, "DEEPGRAM_API_KEY"),
    model: env.DEEPGRAM_MODEL,
    language,
    keyterms: request.keyterms,
  };
}

/** Segmenter profile for a session: `en` keeps the English thresholds, everything else is Vietnamese-capable. */
export function segmenterConfigForSource(env: Env, sourceLang: SourceLang): SegmenterConfig {
  return segmenterConfigForLanguage(resolveSttLanguage(sourceLang, env.DEEPGRAM_LANGUAGE));
}

export function createRealtimeDeps(env: Env): RealtimeDeps {
  const db = openDatabase(env.DB_PATH);
  const repos = createRepositories(db);
  const usageSink = createUsageRecorder(repos.usage, loadPricing());
  return {
    repos,
    audioDir: env.AUDIO_DIR,
    registry: new SessionRegistry(),
    createStt: (request) => createSttProvider(buildSttConfig(env, request)),
    segmenterConfigFor: (sourceLang) => segmenterConfigForSource(env, sourceLang),
    onSessionCreated: createTranslationHook(createTranslatorFromEnv(env, repos, usageSink)),
    usage: {
      sink: usageSink,
      sttVendor: env.STT_PROVIDER,
      sttModel: env.STT_PROVIDER === "assemblyai" ? env.ASSEMBLYAI_MODEL : env.DEEPGRAM_MODEL,
      sttLanguage: env.DEEPGRAM_LANGUAGE,
    },
    close: () => db.close(),
  };
}
