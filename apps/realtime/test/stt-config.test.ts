import { describe, expect, it } from "vitest";
import { findPricing, pricingSchema } from "@recap/core";
import { loadPricingFile } from "@recap/core/node";
import { DEFAULT_SEGMENTER_CONFIG, VI_SEGMENTER_CONFIG } from "@recap/stt";
import { buildSttConfig, segmenterConfigForSource } from "../src/deps";
import { EnvError, parseEnv } from "../src/env";

const SECRET = "sk-super-secret-value";
const base = { OPENAI_API_KEY: SECRET, GEMINI_API_KEY: SECRET };
const request = { sourceLang: "auto" as const, keyterms: ["Biên bản"] };

describe("buildSttConfig", () => {
  it("keeps Deepgram as the default provider", () => {
    const env = parseEnv({ ...base, DEEPGRAM_API_KEY: SECRET });
    expect(buildSttConfig(env, request)).toMatchObject({
      provider: "deepgram",
      model: "nova-3",
      language: "multi",
    });
  });

  it("selects AssemblyAI with its model, key and the resolved language", () => {
    const env = parseEnv({ ...base, STT_PROVIDER: "assemblyai", ASSEMBLYAI_API_KEY: SECRET });
    expect(buildSttConfig(env, { ...request, sourceLang: "vi" })).toMatchObject({
      provider: "assemblyai",
      apiKey: SECRET,
      model: "universal-3-6-pro",
      language: "vi",
      keyterms: ["Biên bản"],
    });
  });

  it("fails with a clear message that does not print values when the key is missing", () => {
    const env = {
      ...parseEnv({ ...base, DEEPGRAM_API_KEY: SECRET }),
      STT_PROVIDER: "assemblyai" as const,
    };
    expect(() => buildSttConfig(env, request)).toThrow(EnvError);
    expect(() => buildSttConfig(env, request)).toThrow(/ASSEMBLYAI_API_KEY is required/);
    expect(() => buildSttConfig(env, request)).not.toThrow(new RegExp(SECRET));
  });
});

describe("segmenter profile by source language", () => {
  const env = parseEnv({ ...base, DEEPGRAM_API_KEY: SECRET });

  it("uses the Vietnamese profile for vi, auto (fallback multi) and multi", () => {
    for (const sourceLang of ["vi", "auto", "multi"] as const) {
      expect(segmenterConfigForSource(env, sourceLang)).toBe(VI_SEGMENTER_CONFIG);
    }
  });

  it("keeps the English config for en, and for auto when the default language is en", () => {
    expect(segmenterConfigForSource(env, "en")).toBe(DEFAULT_SEGMENTER_CONFIG);
    const english = parseEnv({ ...base, DEEPGRAM_API_KEY: SECRET, DEEPGRAM_LANGUAGE: "en" });
    expect(segmenterConfigForSource(english, "auto")).toBe(DEFAULT_SEGMENTER_CONFIG);
  });
});

describe("assemblyai turn silence from env", () => {
  const assembly = { ...base, STT_PROVIDER: "assemblyai", ASSEMBLYAI_API_KEY: SECRET };

  it("passes nothing by default so the language default applies", () => {
    const config = buildSttConfig(parseEnv(assembly), request);
    expect(config).toMatchObject({ minTurnSilenceMs: undefined, maxTurnSilenceMs: undefined });
  });

  it("passes validated overrides to the provider config", () => {
    const env = parseEnv({
      ...assembly,
      ASSEMBLYAI_MIN_TURN_SILENCE_MS: "1000",
      ASSEMBLYAI_MAX_TURN_SILENCE_MS: "4000",
    });
    expect(buildSttConfig(env, request)).toMatchObject({
      minTurnSilenceMs: 1000,
      maxTurnSilenceMs: 4000,
    });
  });

  it("treats blank values as unset and rejects bad ones without echoing values", () => {
    const blank = parseEnv({ ...assembly, ASSEMBLYAI_MIN_TURN_SILENCE_MS: " " });
    expect(blank.ASSEMBLYAI_MIN_TURN_SILENCE_MS).toBeUndefined();
    expect(() => parseEnv({ ...assembly, ASSEMBLYAI_MIN_TURN_SILENCE_MS: "10" })).toThrow(
      /ASSEMBLYAI_MIN_TURN_SILENCE_MS/,
    );
    expect(() => parseEnv({ ...assembly, ASSEMBLYAI_MAX_TURN_SILENCE_MS: "abc" })).toThrow(
      /ASSEMBLYAI_MAX_TURN_SILENCE_MS/,
    );
    expect(() =>
      parseEnv({
        ...assembly,
        ASSEMBLYAI_MIN_TURN_SILENCE_MS: "2000",
        ASSEMBLYAI_MAX_TURN_SILENCE_MS: "1000",
      }),
    ).toThrow(/must be >= ASSEMBLYAI_MIN_TURN_SILENCE_MS/);
  });
});

describe("assemblyai pricing", () => {
  it("is found for stt_live regardless of the session language", () => {
    const pricing = pricingSchema.parse(loadPricingFile());
    for (const language of ["multi", "vi"]) {
      const entry = findPricing(
        {
          vendor: "assemblyai",
          service: "stt_live",
          model: "universal-3-6-pro",
          meta: { language },
        },
        pricing,
      );
      expect(entry?.audioPerMinute).toBe(0.0075);
    }
  });
});
