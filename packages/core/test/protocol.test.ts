import { describe, expect, it } from "vitest";
import {
  CHANNELS,
  FRAME_BYTES,
  FRAME_MS,
  SAMPLE_RATE,
  encodeServerMessage,
  parseClientMessage,
  parseServerMessage,
  type ServerMessage,
} from "../src";

describe("constants", () => {
  it("frame size matches 100 ms of 16 kHz Int16 stereo", () => {
    expect(SAMPLE_RATE).toBe(16_000);
    expect(CHANNELS).toBe(2);
    expect(FRAME_MS).toBe(100);
    expect(FRAME_BYTES).toBe(6400);
  });
});

describe("parseClientMessage", () => {
  it.each([
    { type: "start", meetingId: "m1", sourceLang: "auto", targetLang: "vi" },
    { type: "start", meetingId: "m1", sourceLang: "multi", targetLang: "en", resume: true },
    { type: "mark", kind: "conclusion", atMs: 1200 },
    { type: "mark", kind: "topic", atMs: 1200 },
    { type: "mark", kind: "topic", atMs: 1200, label: "Budget" },
    { type: "unmark", id: "k1" },
    { type: "mark_label", id: "k1", label: "Kế hoạch" },
    { type: "mark_label", id: "k1", label: "" },
    { type: "stop" },
    { type: "ping", t: 123.5 },
  ])("accepts %o", (input) => {
    const result = parseClientMessage(JSON.stringify(input));
    expect(result).toEqual({ ok: true, message: input });
  });

  it.each([
    ["not json", "{oops"],
    ["unknown type", JSON.stringify({ type: "hello" })],
    [
      "bad lang",
      JSON.stringify({ type: "start", meetingId: "m", sourceLang: "fr", targetLang: "vi" }),
    ],
    [
      "target auto",
      JSON.stringify({ type: "start", meetingId: "m", sourceLang: "vi", targetLang: "auto" }),
    ],
    [
      "empty meeting id",
      JSON.stringify({ type: "start", meetingId: "", sourceLang: "vi", targetLang: "en" }),
    ],
    [
      "label too long",
      JSON.stringify({ type: "mark", kind: "topic", atMs: 1, label: "x".repeat(121) }),
    ],
    ["unknown kind", JSON.stringify({ type: "mark", kind: "other", atMs: 1 })],
    ["unmark without id", JSON.stringify({ type: "unmark" })],
    [
      "mark_label too long",
      JSON.stringify({ type: "mark_label", id: "a", label: "x".repeat(121) }),
    ],
    ["negative atMs", JSON.stringify({ type: "mark", kind: "conclusion", atMs: -1 })],
    ["ping without t", JSON.stringify({ type: "ping" })],
    ["array", "[]"],
  ])("rejects %s", (_label, raw) => {
    const result = parseClientMessage(raw);
    expect(result.ok).toBe(false);
  });

  it("accepts Buffer input and already-decoded objects", () => {
    expect(parseClientMessage(Buffer.from('{"type":"stop"}')).ok).toBe(true);
    expect(parseClientMessage({ type: "stop" }).ok).toBe(true);
  });

  it("reports the failing path", () => {
    const result = parseClientMessage({ type: "mark", kind: "conclusion", atMs: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("atMs");
  });
});

describe("parseServerMessage", () => {
  const valid: ServerMessage[] = [
    { type: "ready", meetingId: "m1", startedAt: new Date(0).toISOString() },
    { type: "status", stt: "open", translate: { provider: "gemini", degraded: false } },
    { type: "status", stt: "connecting", translate: { provider: null, degraded: true } },
    { type: "interim", channel: 1, text: "hello", startMs: 0, endMs: 500 },
    {
      type: "segment",
      segment: {
        id: "s1",
        seq: 0,
        channel: 0,
        lang: null,
        startMs: 0,
        endMs: 900,
        text: "xin chào",
      },
    },
    {
      type: "translation",
      segmentId: "s1",
      seq: 0,
      lang: "en",
      text: "hello",
      provider: "gemini",
      latencyMs: 812,
    },
    { type: "mark", mark: { id: "k1", kind: "conclusion", atMs: 3000, label: null } },
    { type: "mark", mark: { id: "k2", kind: "topic", atMs: 4000, label: "Ngân sách" } },
    { type: "unmark", id: "k2" },
    { type: "error", code: "BAD_MESSAGE", message: "nope" },
    { type: "error", code: "TRANSLATE_FAILED", message: "x", segmentId: "s1" },
    { type: "pong", t: 1 },
    { type: "stopped", meetingId: "m1" },
  ];

  it.each(valid)("round-trips %o", (message) => {
    expect(parseServerMessage(encodeServerMessage(message))).toEqual({ ok: true, message });
  });

  it.each([
    { type: "interim", channel: 2, text: "x", startMs: 0, endMs: 1 },
    { type: "status", stt: "weird", translate: { provider: null, degraded: false } },
    { type: "error", code: "NOPE", message: "x" },
    { type: "ready", meetingId: "m1", startedAt: "yesterday" },
    {
      type: "translation",
      segmentId: "s",
      seq: 0,
      lang: "fr",
      text: "",
      provider: "x",
      latencyMs: 1,
    },
  ])("rejects %o", (input) => {
    expect(parseServerMessage(input).ok).toBe(false);
  });
});

describe("legacy mark events", () => {
  it("parses a server mark without label as label null", () => {
    const raw = { type: "mark", mark: { id: "k1", kind: "conclusion", atMs: 5 } };
    expect(parseServerMessage(raw)).toEqual({
      ok: true,
      message: { type: "mark", mark: { id: "k1", kind: "conclusion", atMs: 5, label: null } },
    });
  });
});
