import { describe, expect, it } from "vitest";
import {
  buildListenUrl,
  capKeyterms,
  computeBackoffMs,
  parseDeepgramMessage,
  type DeepgramConfig,
} from "../src";

const config: DeepgramConfig = { apiKey: "secret-key", model: "nova-3", language: "multi" };

describe("buildListenUrl", () => {
  it("contains the required streaming parameters and never the key", () => {
    const url = new URL(buildListenUrl(config));
    expect(url.origin + url.pathname).toBe("wss://api.deepgram.com/v1/listen");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      model: "nova-3",
      language: "multi",
      encoding: "linear16",
      sample_rate: "16000",
      channels: "2",
      multichannel: "true",
      interim_results: "true",
      punctuate: "true",
      smart_format: "true",
      endpointing: "300",
      utterance_end_ms: "1000",
    });
    expect(url.toString()).not.toContain("secret-key");
  });

  it("uses detect_language instead of language for detect mode", () => {
    const url = new URL(buildListenUrl({ ...config, language: "detect" }));
    expect(url.searchParams.get("detect_language")).toBe("true");
    expect(url.searchParams.has("language")).toBe(false);
  });

  it("appends encoded keyterms", () => {
    const url = new URL(buildListenUrl({ ...config, keyterms: ["Kế hoạch", "OKR"] }));
    expect(url.searchParams.getAll("keyterm")).toEqual(["Kế hoạch", "OKR"]);
  });
});

describe("capKeyterms", () => {
  it("caps at 30 terms", () => {
    const terms = Array.from({ length: 50 }, (_, i) => `t${i}`);
    expect(capKeyterms(terms)).toHaveLength(30);
  });

  it("stops at the 2048-char encoded budget", () => {
    const terms = Array.from({ length: 30 }, (_, i) => `${"x".repeat(100)}${i}`);
    const kept = capKeyterms(terms);
    const total = kept.reduce((sum, t) => sum + `&keyterm=${encodeURIComponent(t)}`.length, 0);
    expect(kept.length).toBeLessThan(30);
    expect(total).toBeLessThanOrEqual(2048);
  });

  it("trims, drops empties and dedupes case-insensitively", () => {
    expect(capKeyterms([" OKR ", "okr", "", "KPI"])).toEqual(["OKR", "KPI"]);
  });
});

function resultsMessage(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: "Results",
    channel_index: [1, 2],
    start: 1.2345,
    duration: 2.5,
    is_final: true,
    channel: {
      alternatives: [
        {
          transcript: "hello world",
          words: [
            {
              word: "hello",
              punctuated_word: "Hello",
              start: 1.2345,
              end: 1.8,
              confidence: 0.9,
              language: "en",
            },
            { word: "world", start: 1.9, end: 2.5, confidence: 0.8, language: "en" },
          ],
        },
      ],
    },
    ...overrides,
  });
}

describe("parseDeepgramMessage", () => {
  it("parses a final result with rounded ms, offset and detected language", () => {
    const parsed = parseDeepgramMessage(resultsMessage(), 10_000);
    expect(parsed).toEqual({
      kind: "result",
      isFinal: true,
      result: {
        channel: 1,
        text: "hello world",
        startMs: 11_235,
        endMs: 13_734,
        lang: "en",
        words: [
          { text: "Hello", startMs: 11_235, endMs: 11_800, confidence: 0.9 },
          { text: "world", startMs: 11_900, endMs: 12_500, confidence: 0.8 },
        ],
      },
    });
  });

  it("marks interims and prefers explicit languages", () => {
    const parsed = parseDeepgramMessage(
      resultsMessage({
        is_final: false,
        channel: { alternatives: [{ transcript: "xin chào", languages: ["vi"] }] },
      }),
      0,
    );
    expect(parsed).toMatchObject({
      kind: "result",
      isFinal: false,
      result: { lang: "vi", words: [] },
    });
  });

  it.each([
    ["empty transcript", resultsMessage({ channel: { alternatives: [{ transcript: "  " }] } })],
    ["unknown channel", resultsMessage({ channel_index: [5, 6] })],
    ["metadata", JSON.stringify({ type: "Metadata" })],
    ["invalid json", "{nope"],
    ["null", "null"],
  ])("ignores %s", (_name, raw) => {
    expect(parseDeepgramMessage(raw, 0)).toEqual({ kind: "ignored" });
  });

  it("surfaces provider errors", () => {
    expect(parseDeepgramMessage(JSON.stringify({ type: "Error", description: "bad" }), 0)).toEqual({
      kind: "error",
      message: "bad",
    });
  });
});

describe("computeBackoffMs", () => {
  const cfg = { baseDelayMs: 1000, maxDelayMs: 15_000 };
  it("grows exponentially with equal jitter and caps", () => {
    expect(computeBackoffMs(1, cfg, () => 0)).toBe(500);
    expect(computeBackoffMs(1, cfg, () => 1)).toBe(1000);
    expect(computeBackoffMs(3, cfg, () => 0)).toBe(2000);
    expect(computeBackoffMs(10, cfg, () => 1)).toBe(15_000);
  });
});
