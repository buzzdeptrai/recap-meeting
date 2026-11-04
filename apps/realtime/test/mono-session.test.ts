import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FRAME_BYTES,
  MONO_FRAME_BYTES,
  startMessageSchema,
  type UsageEventInput,
} from "@recap/core";
import { fakeResult } from "@recap/stt";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { monoToStereo } from "../src/audio/mono";
import { buildSttConfig } from "../src/deps";
import { parseEnv } from "../src/env";
import { SttUsageMeter } from "../src/session/stt-usage-meter";
import { createHarness, startMessage, TestClient, type Harness } from "./helpers";

describe("monoToStereo", () => {
  it("puts the mono samples on the left and silence on the right", () => {
    const stereo = monoToStereo(new Uint8Array([1, 2, 3, 4]));
    expect([...stereo]).toEqual([1, 2, 0, 0, 3, 4, 0, 0]);
  });

  it("doubles a protocol mono frame to a stereo frame", () => {
    expect(monoToStereo(new Uint8Array(MONO_FRAME_BYTES)).length).toBe(FRAME_BYTES);
  });
});

describe("protocol", () => {
  it("accepts channels 1 or 2 and rejects anything else", () => {
    const base = { type: "start", meetingId: "m1", sourceLang: "vi", targetLang: "en" };
    expect(startMessageSchema.safeParse({ ...base, channels: 1 }).success).toBe(true);
    expect(startMessageSchema.safeParse({ ...base, channels: 2 }).success).toBe(true);
    expect(startMessageSchema.safeParse(base).success).toBe(true);
    expect(startMessageSchema.safeParse({ ...base, channels: 3 }).success).toBe(false);
  });
});

describe("STT config for a mono session", () => {
  const env = parseEnv({
    OPENAI_API_KEY: "x",
    GEMINI_API_KEY: "x",
    DEEPGRAM_API_KEY: "x",
    ASSEMBLYAI_API_KEY: "x",
  });
  const request = { sourceLang: "vi" as const, keyterms: [] };

  it("asks both vendors for one channel only when mono", () => {
    expect(buildSttConfig(env, { ...request, mono: true })).toMatchObject({ channels: 1 });
    const assembly = { ...env, STT_PROVIDER: "assemblyai" as const };
    expect(buildSttConfig(assembly, { ...request, mono: true })).toMatchObject({ channels: 1 });
    expect(buildSttConfig(env, request)).not.toHaveProperty("channels");
  });
});

describe("usage metering for a mono session", () => {
  it("bills one channel per frame", () => {
    const events: UsageEventInput[] = [];
    const meter = new SttUsageMeter({
      meetingId: "m",
      sink: (e) => events.push(e),
      model: "nova-3",
      language: "vi",
      channels: 1,
    });
    for (let i = 0; i < 10; i++) meter.addFrame();
    meter.stop();
    expect(events[0]).toMatchObject({
      audioSeconds: 1,
      meta: { channels: 1, perChannelSeconds: 1 },
    });
  });
});

describe("mono session over the socket", () => {
  let harness: Harness;
  let client: TestClient;
  const requests: Array<{ mono?: boolean }> = [];

  beforeEach(async () => {
    requests.length = 0;
    harness = await createHarness();
    const original = harness.deps.createStt;
    harness.deps.createStt = (request) => {
      requests.push({ mono: request.mono });
      return original(request);
    };
    client = await TestClient.connect(harness.port);
  });
  afterEach(async () => {
    await client.close();
    await harness.close();
  });

  const newMeeting = () => harness.deps.repos.meetings.create({ title: "Mobile" }).id;

  it("takes mono frames, forwards them to STT and stores a stereo wav", async () => {
    const meetingId = newMeeting();
    client.sendJson(startMessage(meetingId, { channels: 1 }));
    await client.waitForType("ready");
    const stt = harness.providers[0]!;
    stt.whenFrame(2, (p) => p.emitFinal(fakeResult(0, "xin chào cả nhà", 0, 1000, "vi")));
    client.sendFrames(2, MONO_FRAME_BYTES);
    client.sendJson({ type: "stop" });
    await client.waitForType("stopped");

    expect(requests).toEqual([{ mono: true }]);
    expect(stt.frames.map((f) => f.length)).toEqual([MONO_FRAME_BYTES, MONO_FRAME_BYTES]);
    expect(client.of("segment")[0]?.segment).toMatchObject({ channel: 0, text: "xin chào cả nhà" });
    const wav = readFileSync(join(harness.audioDir, `${meetingId}.wav`));
    expect(wav.length).toBe(44 + 2 * FRAME_BYTES);
  });

  it("rejects a stereo-sized frame in a mono session", async () => {
    const meetingId = newMeeting();
    client.sendJson(startMessage(meetingId, { channels: 1 }));
    await client.waitForType("ready");
    client.sendFrames(1, FRAME_BYTES);
    client.sendFrames(1, MONO_FRAME_BYTES);
    client.sendJson({ type: "stop" });
    await client.waitForType("stopped");
    expect(harness.providers[0]!.frames).toHaveLength(1);
  });

  it("leaves the default two-channel session untouched", async () => {
    const meetingId = newMeeting();
    client.sendJson(startMessage(meetingId));
    await client.waitForType("ready");
    client.sendFrames(1, MONO_FRAME_BYTES);
    client.sendFrames(1, FRAME_BYTES);
    client.sendJson({ type: "stop" });
    await client.waitForType("stopped");
    expect(requests).toEqual([{ mono: false }]);
    expect(harness.providers[0]!.frames.map((f) => f.length)).toEqual([FRAME_BYTES]);
  });
});
