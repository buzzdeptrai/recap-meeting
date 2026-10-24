import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FRAME_BYTES, type ServerMessage } from "@recap/core";
import { IN_MEMORY, createRepositories, openDatabase } from "@recap/db";
import { FakeSttProvider } from "@recap/stt";
import { AudioWriter } from "../src/audio/audio-writer";
import { MeetingSession } from "../src/session/meeting-session";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MIN_INTERVAL_MS = 3_000;
const MAX_RETRIES = 3;

/** Provider whose open() can be scripted to fail or to stay pending. */
class ScriptedProvider extends FakeSttProvider {
  opens = 0;
  failNext = false;
  private pending: { resolve: () => void; reject: (e: Error) => void } | null = null;
  holdNext = false;

  override async open(): Promise<void> {
    this.opens += 1;
    if (this.holdNext) {
      this.holdNext = false;
      this.setStatus("connecting");
      await new Promise<void>((resolve, reject) => {
        this.pending = { resolve, reject };
      });
      this.setStatus("open");
      return;
    }
    if (this.failNext) {
      this.failNext = false;
      this.setStatus("connecting");
      this.setStatus("closed");
      throw new Error("secret-key-abc connection refused");
    }
    return super.open();
  }

  settle(error?: Error): void {
    if (error) this.pending?.reject(error);
    else this.pending?.resolve();
    this.pending = null;
  }
}

let now = 0;
let sent: ServerMessage[];
let provider: ScriptedProvider;
let session: MeetingSession;
const usage: Array<{ audioSeconds?: number | null }> = [];

function build(): MeetingSession {
  const repos = createRepositories(openDatabase(IN_MEMORY));
  const meeting = repos.meetings.create({ title: "Retry" });
  const audio = AudioWriter.open(join(mkdtempSync(join(tmpdir(), "recap-retry-")), "a.wav"), {});
  return new MeetingSession({
    meeting,
    repos,
    stt: provider,
    audio,
    sink: (m) => sent.push(m),
    baseMs: 0,
    sourceLang: "multi",
    targetLang: "vi",
    usage: { sink: (row) => usage.push(row), model: "m", language: "multi" },
    sttRetry: { minIntervalMs: MIN_INTERVAL_MS, maxAttempts: MAX_RETRIES, now: () => now },
  });
}

const errors = () =>
  sent.filter((m): m is Extract<ServerMessage, { type: "error" }> => m.type === "error");
const lastStatus = () =>
  sent.filter((m): m is Extract<ServerMessage, { type: "status" }> => m.type === "status").at(-1)
    ?.stt;
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const frame = () => new Uint8Array(FRAME_BYTES);

beforeEach(async () => {
  now = 10_000;
  sent = [];
  usage.length = 0;
  provider = new ScriptedProvider();
  session = build();
  await session.start();
});
afterEach(async () => {
  await session.stop("disconnect");
});

describe("MeetingSession.requestSttRetry", () => {
  it("restarts the provider when it is closed and reports open", async () => {
    provider.setStatus("closed");
    sent.length = 0;
    session.requestSttRetry();
    await flush();
    expect(provider.opens).toBe(2);
    expect(lastStatus()).toBe("open");
    expect(errors()).toEqual([]);
  });

  it("is a no-op with STT_ALREADY_OPEN while the provider is open", async () => {
    session.requestSttRetry();
    session.requestSttRetry();
    await flush();
    expect(provider.opens).toBe(1);
    expect(errors().map((e) => e.code)).toEqual(["STT_ALREADY_OPEN", "STT_ALREADY_OPEN"]);
    expect(lastStatus()).toBe("open");
  });

  it("double click while the retry is in flight starts only one attempt", async () => {
    provider.setStatus("closed");
    provider.holdNext = true;
    session.requestSttRetry();
    session.requestSttRetry();
    expect(provider.opens).toBe(2);
    expect(errors().map((e) => e.code)).toEqual(["STT_ALREADY_OPEN"]);
    provider.settle();
    await flush();
    expect(lastStatus()).toBe("open");
  });

  it("refuses with NOT_RECORDING once the session is stopped", async () => {
    provider.setStatus("closed");
    await session.stop("client");
    sent.length = 0;
    session.requestSttRetry();
    await flush();
    expect(provider.opens).toBe(1);
    expect(errors().map((e) => e.code)).toEqual(["NOT_RECORDING"]);
  });

  it("rate limits: min interval between attempts, max attempts per session", async () => {
    provider.failNext = true;
    provider.setStatus("closed");
    session.requestSttRetry();
    await flush();
    expect(lastStatus()).toBe("closed");

    session.requestSttRetry();
    await flush();
    expect(errors().at(-1)?.code).toBe("RATE_LIMITED");
    expect(provider.opens).toBe(2);

    for (let i = 0; i < MAX_RETRIES; i++) {
      now += MIN_INTERVAL_MS;
      provider.failNext = true;
      session.requestSttRetry();
      await flush();
    }
    now += MIN_INTERVAL_MS;
    session.requestSttRetry();
    await flush();
    expect(errors().at(-1)?.code).toBe("RATE_LIMITED");
    expect(provider.opens).toBe(1 + MAX_RETRIES);
  });

  it("a second failure returns to closed without leaking the provider message", async () => {
    provider.setStatus("closed");
    provider.failNext = true;
    session.requestSttRetry();
    await flush();
    expect(lastStatus()).toBe("closed");
    expect(JSON.stringify(sent)).not.toContain("secret-key-abc");
    now += MIN_INTERVAL_MS;
    sent.length = 0;
    session.requestSttRetry();
    await flush();
    expect(lastStatus()).toBe("open");
  });

  it("keeps the audio flowing and meters the frames of a failed attempt zero times", async () => {
    provider.setStatus("closed");
    provider.holdNext = true;
    session.requestSttRetry();
    session.handleAudio(frame());
    session.handleAudio(frame());
    provider.settle(new Error("nope"));
    await flush();
    expect(session.acceptedFrames).toBe(2);
    await session.stop("client");
    expect(usage).toEqual([]);
  });

  it("meters frames buffered during a successful retry once", async () => {
    provider.setStatus("closed");
    provider.holdNext = true;
    session.requestSttRetry();
    session.handleAudio(frame());
    provider.settle();
    await flush();
    session.handleAudio(frame());
    await session.stop("client");
    expect(usage).toHaveLength(1);
    expect(usage[0]?.audioSeconds ?? 0).toBeCloseTo(0.4); // 2 frames x 100 ms x 2 channels
  });

  it("stop during a pending retry leaves no timers and no late status", async () => {
    vi.useFakeTimers();
    try {
      provider.setStatus("closed");
      provider.holdNext = true;
      session.requestSttRetry();
      const stopping = session.stop("client");
      provider.settle(new Error("closed while connecting"));
      await stopping;
      sent.length = 0;
      provider.setStatus("open");
      expect(sent).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
