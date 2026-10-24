import { afterEach, describe, expect, it, vi } from "vitest";
import { createUsageRecorder } from "@recap/db";
import type { UsageEventInput } from "@recap/core";
import { SttUsageMeter } from "../src/session/stt-usage-meter";
import { toUsageEvent } from "../src/translation";
import { createHarness, startMessage, TestClient, type Harness } from "./helpers";

describe("SttUsageMeter", () => {
  afterEach(() => vi.useRealTimers());

  it("records channel-seconds on stop and flushes periodically", () => {
    vi.useFakeTimers();
    const events: UsageEventInput[] = [];
    const meter = new SttUsageMeter({
      meetingId: "m",
      sink: (e) => events.push(e),
      model: "nova-3",
      language: "multi",
      intervalMs: 1000,
    });
    meter.start();
    for (let i = 0; i < 10; i++) meter.addFrame(); // 10 * 100ms = 1s per channel
    vi.advanceTimersByTime(1000);
    for (let i = 0; i < 5; i++) meter.addFrame();
    meter.stop();
    meter.stop(); // idempotent: nothing left
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      vendor: "deepgram",
      service: "stt_live",
      audioSeconds: 2,
      meetingId: "m",
      meta: { perChannelSeconds: 1, channels: 2, flush: "periodic" },
    });
    expect(events[1]).toMatchObject({ audioSeconds: 1, meta: { flush: "final" } });
  });

  it("records the configured vendor (assemblyai socket-seconds) and defaults to deepgram", () => {
    const events: UsageEventInput[] = [];
    const meter = new SttUsageMeter({
      meetingId: "m",
      sink: (e) => events.push(e),
      vendor: "assemblyai",
      model: "universal-3-6-pro",
      language: "vi",
    });
    for (let i = 0; i < 10; i++) meter.addFrame();
    meter.stop();
    expect(events[0]).toMatchObject({
      vendor: "assemblyai",
      model: "universal-3-6-pro",
      audioSeconds: 2, // two mono sockets open for 1 s each
    });
  });

  it("writes nothing for a silent session and survives a throwing sink", () => {
    const meter = new SttUsageMeter({
      meetingId: "m",
      sink: () => {
        throw new Error("x");
      },
      model: "nova-3",
      language: "vi",
    });
    meter.stop();
    meter.addFrame();
    expect(() => meter.stop()).not.toThrow();
  });
});

describe("session usage wiring", () => {
  let harness: Harness;
  afterEach(async () => harness.close());

  it("records deepgram usage linked to the meeting when the session stops", async () => {
    harness = await createHarness();
    const { repos } = harness.deps;
    harness.deps.usage = {
      sink: createUsageRecorder(repos.usage, { version: 1, currency: "USD", entries: [] }),
      sttModel: "nova-3",
      sttLanguage: "multi",
    };
    const meetingId = repos.meetings.create({ title: "metered" }).id;
    const client = await TestClient.connect(harness.port);
    client.sendJson(startMessage(meetingId));
    await client.waitForType("ready");
    client.sendFrames(20);
    await new Promise((r) => setTimeout(r, 100));
    client.sendJson({ type: "stop" });
    await client.waitForType("stopped");
    await client.close();
    const range = { from: "2000-01-01T00:00:00.000Z", to: "2999-01-01T00:00:00.000Z" };
    const [row] = repos.usage.aggregate({ ...range, groupBy: "meeting" });
    expect(row).toMatchObject({ key: meetingId, requests: 1 });
    expect(row?.audioSeconds).toBeCloseTo(4, 5); // 20 frames * 0.1s * 2 channels
  });
});

describe("toUsageEvent", () => {
  it("maps a translation attempt", () => {
    expect(
      toUsageEvent({
        meetingId: "m",
        provider: "openai",
        model: "gpt-4.1-mini",
        inputTokens: 1,
        outputTokens: 2,
        latencyMs: 3,
        status: "fallback",
      }),
    ).toMatchObject({ vendor: "openai", service: "translate", status: "fallback", meetingId: "m" });
  });
});
