import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAME_BYTES, FRAME_MS, type UsageEventInput } from "@recap/core";
import { IN_MEMORY, createRepositories, openDatabase } from "@recap/db";
import { FakeSttProvider, type SttUsageSource } from "@recap/stt";
import { AudioWriter } from "../src/audio/audio-writer";
import { buildSttConfig } from "../src/deps";
import { parseEnv } from "../src/env";
import { MeetingSession } from "../src/session/meeting-session";

const SECRET = "sk-secret-value";
const TOTAL_FRAMES = 50;
const MIC_ACTIVE_FRAMES = 10; // the mic channel stays parked for the other 40
const MS_PER_SECOND = 1000;

/** Fake provider that, like AssemblyAI with gating, reports only the channel-frames it sent. */
class GatedFake extends FakeSttProvider {
  private sent = 0;
  private count = 0;
  readonly usage: SttUsageSource = {
    takeSentChannelFrames: () => {
      const n = this.sent;
      this.sent = 0;
      return n;
    },
  };

  override sendAudio(frame: Uint8Array): void {
    super.sendAudio(frame);
    this.count += 1;
    // tab always sent (1 channel-frame); mic only during the first MIC_ACTIVE_FRAMES frames
    this.sent += this.count <= MIC_ACTIVE_FRAMES ? 2 : 1;
  }
}

function runSession(provider: FakeSttProvider) {
  const repos = createRepositories(openDatabase(IN_MEMORY));
  const meeting = repos.meetings.create({ title: "Idle" });
  const audio = AudioWriter.open(join(mkdtempSync(join(tmpdir(), "recap-idle-")), "a.wav"), {});
  const usage: UsageEventInput[] = [];
  const session = new MeetingSession({
    meeting,
    repos,
    stt: provider,
    audio,
    sink: () => undefined,
    baseMs: 0,
    sourceLang: "multi",
    targetLang: "vi",
    usage: { sink: (row) => usage.push(row), model: "m", language: "multi" },
  });
  return { session, usage, audio };
}

describe("usage with silence gating", () => {
  it("bills only what the provider sent while the WAV still gets every frame", async () => {
    const { session, usage, audio } = runSession(new GatedFake());
    await session.start();
    for (let i = 0; i < TOTAL_FRAMES; i += 1) session.handleAudio(new Uint8Array(FRAME_BYTES));
    const recordedMs = audio.durationMs;
    await session.stop("client");
    expect(session.acceptedFrames).toBe(TOTAL_FRAMES);
    expect(recordedMs).toBe(TOTAL_FRAMES * FRAME_MS);
    const channelFrames = MIC_ACTIVE_FRAMES * 2 + (TOTAL_FRAMES - MIC_ACTIVE_FRAMES);
    expect(usage).toHaveLength(1);
    expect(usage[0]?.audioSeconds).toBeCloseTo((channelFrames * FRAME_MS) / MS_PER_SECOND, 5);
    expect(usage[0]?.audioSeconds).toBeLessThan((TOTAL_FRAMES * 2 * FRAME_MS) / MS_PER_SECOND);
  });

  it("keeps billing every frame on both channels for providers without a usage hook", async () => {
    const { session, usage } = runSession(new FakeSttProvider());
    await session.start();
    for (let i = 0; i < TOTAL_FRAMES; i += 1) session.handleAudio(new Uint8Array(FRAME_BYTES));
    await session.stop("client");
    expect(usage[0]?.audioSeconds).toBeCloseTo((TOTAL_FRAMES * 2 * FRAME_MS) / MS_PER_SECOND, 5);
  });
});

describe("STT_IDLE_AFTER_MS", () => {
  const base = { OPENAI_API_KEY: SECRET, GEMINI_API_KEY: SECRET, ASSEMBLYAI_API_KEY: SECRET };
  const request = { sourceLang: "vi" as const, keyterms: [] };

  it("defaults to 30 s, accepts 0 to disable, rejects negatives", () => {
    const env = parseEnv({ ...base, STT_PROVIDER: "assemblyai" });
    expect(env.STT_IDLE_AFTER_MS).toBe(30_000);
    expect(
      parseEnv({ ...base, STT_PROVIDER: "assemblyai", STT_IDLE_AFTER_MS: "0" }).STT_IDLE_AFTER_MS,
    ).toBe(0);
    expect(() =>
      parseEnv({ ...base, STT_PROVIDER: "assemblyai", STT_IDLE_AFTER_MS: "-1" }),
    ).toThrow();
  });

  it("is passed to AssemblyAI only; Deepgram config is unchanged", () => {
    const assembly = parseEnv({ ...base, STT_PROVIDER: "assemblyai", STT_IDLE_AFTER_MS: "12000" });
    expect(buildSttConfig(assembly, request)).toMatchObject({ idleAfterMs: 12_000 });
    const deepgram = parseEnv({ ...base, DEEPGRAM_API_KEY: SECRET });
    expect(buildSttConfig(deepgram, request)).not.toHaveProperty("idleAfterMs");
  });
});
