import { FRAME_BYTES, FRAME_SAMPLES } from "@recap/core";
import { describe, expect, it } from "vitest";
import { toStereoFrames } from "../src/audio";
import { alignmentRows, formatAlignment } from "../src/alignment";
import { markAtMs } from "../src/client";
import { parseOptions, parseSpeed } from "../src/options";
import { formatTime } from "../src/printer";
import { summarize } from "../src/summary";

describe("toStereoFrames", () => {
  it("makes exact-size frames with ch0 silent and ch1 carrying the audio", () => {
    const others = Int16Array.from({ length: FRAME_SAMPLES + 5 }, (_, i) => i + 1);
    const frames = toStereoFrames(null, others);
    expect(frames).toHaveLength(2);
    expect(frames.every((frame) => frame.length === FRAME_BYTES)).toBe(true);
    const first = new Int16Array(frames[0]!.buffer);
    expect([first[0], first[1], first[2], first[3]]).toEqual([0, 1, 0, 2]);
    const last = new Int16Array(frames[1]!.buffer);
    expect([last[8], last[9], last[10], last[11]]).toEqual([0, FRAME_SAMPLES + 5, 0, 0]);
  });

  it("places the mic on ch0 and pads the shorter side", () => {
    const frames = toStereoFrames(Int16Array.of(7, 8, 9), Int16Array.of(1));
    const samples = new Int16Array(frames[0]!.buffer);
    expect([samples[0], samples[1], samples[2], samples[3], samples[4], samples[5]]).toEqual([
      7, 1, 8, 0, 9, 0,
    ]);
  });
});

describe("options", () => {
  it("parses speed and rejects nonsense", () => {
    expect(parseSpeed("4")).toBe(4);
    expect(parseSpeed("max")).toBe(Infinity);
    expect(() => parseSpeed("0")).toThrow();
    expect(() => parseSpeed("fast")).toThrow();
  });

  it("applies defaults, validates languages, and supports --help", () => {
    expect(parseOptions(["--file", "a/b.m4a"])).toMatchObject({
      file: "a/b.m4a",
      sourceLang: "multi",
      targetLang: "vi",
      speed: 1,
      url: "ws://localhost:4001/ws",
      title: "stream-file b.m4a",
    });
    expect(parseOptions(["--help"])).toBeNull();
    expect(() => parseOptions([])).toThrow(/--file/);
    expect(() => parseOptions(["--file", "x", "--target-lang", "fr"])).toThrow(/target-lang/);
  });
});

describe("summarize", () => {
  it("counts segments, translations, failures and averages latency", () => {
    const summary = summarize([
      { type: "status", stt: "open", translate: { provider: "gemini", degraded: false } },
      {
        type: "segment",
        segment: { id: "a", seq: 0, channel: 1, lang: "en", startMs: 0, endMs: 1, text: "x" },
      },
      {
        type: "translation",
        segmentId: "a",
        seq: 0,
        lang: "vi",
        text: "y",
        provider: "gemini",
        latencyMs: 100,
      },
      {
        type: "translation",
        segmentId: "b",
        seq: 1,
        lang: "vi",
        text: "z",
        provider: "openai",
        latencyMs: 301,
      },
      { type: "error", code: "TRANSLATE_FAILED", message: "m", segmentId: "c" },
      { type: "error", code: "STT_UNAVAILABLE", message: "down" },
    ]);
    expect(summary).toMatchObject({
      segments: 1,
      translations: 2,
      translateErrors: 1,
      avgTranslationLatencyMs: 201,
      providers: ["gemini", "openai"],
      otherErrors: ["STT_UNAVAILABLE: down"],
      lastStatus: { stt: "open", provider: "gemini", degraded: false },
    });
  });
});

describe("formatTime", () => {
  it("formats mm:ss.s", () => {
    expect(formatTime(65_400)).toBe("01:05.4");
  });
});

describe("mark clock and alignment", () => {
  it("parses --mark-clock", () => {
    expect(parseOptions(["--file", "x"])?.markClock).toBe("audio");
    expect(parseOptions(["--file", "x", "--mark-clock", "wall"])?.markClock).toBe("wall");
    expect(() => parseOptions(["--file", "x", "--mark-clock", "cpu"])).toThrow(/mark-clock/);
  });

  it("markAtMs: audio keeps the exact offset, wall mirrors the browser clockOrigin", () => {
    const origin = 1_000_000 - 4_000; // ready received at 1_000_000 with baseMs 4000
    expect(markAtMs("audio", { atMs: 9_000 }, 1_005_050, origin)).toBe(9_000);
    expect(markAtMs("wall", { atMs: 9_000 }, 1_005_050, origin)).toBe(9_050);
    expect(markAtMs("wall", { atMs: 0 }, 900_000, origin)).toBe(0);
  });

  it("alignmentRows reports distance to the nearest final segment and the clock error", () => {
    const segment = (seq: number, startMs: number, endMs: number) =>
      ({
        type: "segment",
        segment: { id: String(seq), seq, channel: 1, lang: "en", startMs, endMs, text: `s${seq}` },
      }) as const;
    const rows = alignmentRows(
      [
        { kind: "conclusion", atMs: 5_120, audioAtMs: 5_000 },
        { kind: "conclusion", atMs: 20_000, audioAtMs: 20_000 },
      ],
      [segment(0, 5_000, 8_000), segment(1, 10_000, 12_000)],
    );
    expect(rows[0]).toMatchObject({ clockErrorMs: 120, fromStartMs: 120, fromEndMs: -2_880 });
    expect(rows[0]?.segment?.seq).toBe(0);
    expect(rows[1]).toMatchObject({ clockErrorMs: 0, fromEndMs: 8_000 });
    expect(rows[1]?.segment?.seq).toBe(1);
    expect(alignmentRows([{ kind: "topic", atMs: 1, audioAtMs: 1 }], [])[0]?.segment).toBeNull();
    expect(formatAlignment(rows)[0]).toContain("wall-vs-audio +120 ms");
  });
});
