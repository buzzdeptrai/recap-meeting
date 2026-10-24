import { describe, expect, it } from "vitest";
import {
  buildStreamUrl,
  capAssemblyAiKeyterms,
  parseAssemblyAiMessage,
  splitStereo,
  type AssemblyAiConfig,
} from "../src";

const config: AssemblyAiConfig = { apiKey: "k-123", model: "universal-3-6-pro", language: "multi" };

const turn = (extra: Record<string, unknown>) =>
  JSON.stringify({
    type: "Turn",
    transcript: "xin chào các bạn",
    words: [
      { text: "xin", start: 100, end: 300, confidence: 0.9 },
      { text: "chào", start: 300, end: 600, confidence: 0.8 },
    ],
    ...extra,
  });

describe("buildStreamUrl", () => {
  it("never puts the key in the URL and requests mono pcm_s16le at 16 kHz", () => {
    const url = new URL(buildStreamUrl({ ...config, language: "en" }));
    expect(url.toString()).not.toContain("k-123");
    expect(url.searchParams.get("speech_model")).toBe("universal-3-6-pro");
    expect(url.searchParams.get("encoding")).toBe("pcm_s16le");
    expect(url.searchParams.get("sample_rate")).toBe("16000");
    expect(url.searchParams.get("language_detection")).toBe("true");
    expect(url.searchParams.get("min_turn_silence")).toBe("800");
    expect(url.searchParams.get("max_turn_silence")).toBe("2500");
  });

  it("uses slow turn silence 1200/3500 for vi/multi/detect and honours explicit overrides", () => {
    for (const language of ["vi", "multi", "detect"] as const) {
      const url = new URL(buildStreamUrl({ ...config, language }));
      expect(url.searchParams.get("min_turn_silence")).toBe("1200");
      expect(url.searchParams.get("max_turn_silence")).toBe("3500");
    }
    const custom = new URL(
      buildStreamUrl({ ...config, language: "vi", minTurnSilenceMs: 900, maxTurnSilenceMs: 2000 }),
    );
    expect(custom.searchParams.get("min_turn_silence")).toBe("900");
    expect(custom.searchParams.get("max_turn_silence")).toBe("2000");
  });

  it("auto-detects for multi/detect and steers fixed languages with language_codes", () => {
    for (const language of ["multi", "detect"] as const) {
      const url = new URL(buildStreamUrl({ ...config, language }));
      expect(url.searchParams.has("language_codes")).toBe(false);
    }
    const vi = new URL(buildStreamUrl({ ...config, language: "vi" }));
    expect(vi.searchParams.get("language_codes")).toBe('["vi"]');
  });

  it("sends capped keyterms as a JSON array and honours baseUrl", () => {
    const url = new URL(
      buildStreamUrl({
        ...config,
        keyterms: ["Biên bản", "biên bản", "x".repeat(51)],
        baseUrl: "ws://h:1/p",
      }),
    );
    expect(url.origin + url.pathname).toBe("ws://h:1/p");
    expect(url.searchParams.get("keyterms_prompt")).toBe('["Biên bản"]');
  });

  it("caps keyterms at 100 entries", () => {
    const terms = Array.from({ length: 150 }, (_, i) => `t${i}`);
    expect(capAssemblyAiKeyterms(terms)).toHaveLength(100);
  });
});

describe("parseAssemblyAiMessage", () => {
  it("maps a partial turn to an interim result on the session timeline", () => {
    const parsed = parseAssemblyAiMessage(turn({ end_of_turn: false }), 1, 400);
    expect(parsed).toMatchObject({ kind: "result", isFinal: false });
    if (parsed.kind !== "result") throw new Error("expected result");
    expect(parsed.result).toMatchObject({ channel: 1, startMs: 500, endMs: 1000, lang: null });
    expect(parsed.result.words[1]).toEqual({
      text: "chào",
      startMs: 700,
      endMs: 1000,
      confidence: 0.8,
    });
  });

  it("maps a formatted end_of_turn to a final with the detected language", () => {
    const parsed = parseAssemblyAiMessage(
      turn({ end_of_turn: true, turn_is_formatted: true, language_code: "vi" }),
      0,
      0,
    );
    expect(parsed).toMatchObject({ kind: "result", isFinal: true, result: { lang: "vi" } });
  });

  it("treats an unformatted end_of_turn as interim and uses SpeechStarted timing without words", () => {
    const unformatted = parseAssemblyAiMessage(
      turn({ end_of_turn: true, turn_is_formatted: false }),
      0,
      0,
    );
    expect(unformatted).toMatchObject({ kind: "result", isFinal: false });
    const noWords = parseAssemblyAiMessage(
      JSON.stringify({ type: "Turn", transcript: "hi", end_of_turn: false }),
      0,
      1000,
      250,
    );
    expect(noWords).toMatchObject({ kind: "result", result: { startMs: 1250, endMs: 1250 } });
  });

  it("recognises control messages and ignores empty or malformed ones", () => {
    expect(parseAssemblyAiMessage('{"type":"SpeechStarted","timestamp":42}', 0, 0)).toEqual({
      kind: "speech_started",
      timestampMs: 42,
    });
    expect(parseAssemblyAiMessage('{"type":"Termination"}', 0, 0)).toEqual({ kind: "termination" });
    expect(parseAssemblyAiMessage('{"type":"Begin"}', 0, 0)).toEqual({ kind: "ignored" });
    expect(parseAssemblyAiMessage(turn({ transcript: " " }), 0, 0)).toEqual({ kind: "ignored" });
    expect(parseAssemblyAiMessage("nope", 0, 0)).toEqual({ kind: "ignored" });
  });

  it("flags auth errors as non-retryable but the session rate limit as retryable", () => {
    const auth =
      '{"type":"Error","error_code":1008,"error":"Unauthorized Connection: Invalid API key"}';
    const rate =
      '{"type":"Error","error_code":1008,"error":"Unauthorized Connection: Too many concurrent sessions"}';
    expect(parseAssemblyAiMessage(auth, 0, 0)).toMatchObject({ kind: "error", retryable: false });
    expect(parseAssemblyAiMessage(rate, 0, 0)).toMatchObject({ kind: "error", retryable: true });
  });
});

describe("splitStereo", () => {
  it("separates interleaved Int16 stereo into left and right mono buffers", () => {
    const stereo = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const [left, right] = splitStereo(stereo);
    expect([...left]).toEqual([1, 2, 5, 6]);
    expect([...right]).toEqual([3, 4, 7, 8]);
  });

  it("drops a trailing partial sample frame", () => {
    const [left, right] = splitStereo(new Uint8Array([1, 2, 3, 4, 9, 9]));
    expect(left.byteLength).toBe(2);
    expect(right.byteLength).toBe(2);
  });
});
