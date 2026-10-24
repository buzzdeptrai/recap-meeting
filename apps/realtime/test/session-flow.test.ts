import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FRAME_BYTES } from "@recap/core";
import { fakeResult } from "@recap/stt";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHarness, startMessage, TestClient, type Harness } from "./helpers";

let harness: Harness;
let client: TestClient;

beforeEach(async () => {
  harness = await createHarness();
  client = await TestClient.connect(harness.port);
});
afterEach(async () => {
  await client.close();
  await harness.close();
});

const newMeeting = () => harness.deps.repos.meetings.create({ title: "Weekly sync" }).id;

async function startSession(meetingId: string, extra: Record<string, unknown> = {}) {
  client.sendJson(startMessage(meetingId, extra));
  await client.waitForType("ready");
  return harness.providers.at(-1);
}

describe("full session flow", () => {
  it("start → frames → interim/segment → mark → stop persists everything", async () => {
    const meetingId = newMeeting();
    harness.deps.repos.glossary.create({ term: "Deepgram", lang: "en", variants: ["deep gram"] });
    client = await TestClient.connect(harness.port);
    client.sendJson(startMessage(meetingId));
    await client.waitForType("ready");
    const stt = harness.providers[0]!;
    stt
      .whenFrame(1, (p) => p.emitInterim(fakeResult(0, "hello there everyone how", 0, 400)))
      .whenFrame(2, (p) =>
        p.emitFinal(fakeResult(0, "hello there everyone how are you today", 0, 1000, "en")),
      )
      .whenFrame(3, (p) =>
        p.emitFinal(fakeResult(1, "chúng ta dùng deep gram cho bản ghi âm", 1000, 2000, "vi")),
      )
      .whenFrame(4, (p) => p.emitInterim(fakeResult(0, "left over words", 2000, 2300)));

    client.sendFrames(4);
    await client.waitFor((m) => m.type === "segment" && m.segment.channel === 1);
    client.sendJson({ type: "mark", kind: "conclusion", atMs: 1200 });
    await client.waitForType("mark");
    client.sendJson({ type: "stop" });
    await client.waitForType("stopped");

    expect(client.of("ready")[0]).toMatchObject({ meetingId });
    expect(client.of("status")[0]).toMatchObject({ stt: "open" });
    expect(client.of("interim")[0]).toMatchObject({ channel: 0, text: "hello there everyone how" });
    const segments = client.of("segment").map((m) => m.segment);
    expect(segments.map((s) => [s.seq, s.channel])).toEqual([
      [0, 0],
      [1, 1],
      [2, 0],
    ]);
    expect(segments[1]).toMatchObject({
      text: "chúng ta dùng Deepgram cho bản ghi âm",
      lang: "vi",
      startMs: 1000,
      endMs: 2000,
    });
    expect(segments[2]?.text).toBe("left over words"); // flushed on stop
    expect(client.messages.at(-1)).toEqual({ type: "stopped", meetingId });

    const { repos } = harness.deps;
    expect(repos.segments.listByMeeting(meetingId).map((s) => s.seq)).toEqual([0, 1, 2]);
    expect(repos.marks.list(meetingId)).toMatchObject([{ kind: "conclusion", atMs: 1200 }]);
    const meeting = repos.meetings.get(meetingId);
    expect(meeting).toMatchObject({ status: "ended" });
    expect(meeting?.startedAt).toBeTruthy();
    expect(meeting?.durationMs).not.toBeNull();
    expect(stt.closed).toBe(true);
    expect(harness.deps.registry.size).toBe(0);

    const wav = readFileSync(join(harness.audioDir, `${meetingId}.wav`));
    expect(wav.length).toBe(44 + 4 * FRAME_BYTES);
    expect(wav.readUInt32LE(40)).toBe(4 * FRAME_BYTES);
  });

  it("marks the meeting live while the session runs", async () => {
    const meetingId = newMeeting();
    await startSession(meetingId);
    expect(harness.deps.repos.meetings.get(meetingId)?.status).toBe("live");
    expect(harness.deps.registry.has(meetingId)).toBe(true);
  });

  it("forwards STT status changes", async () => {
    await startSession(newMeeting());
    harness.providers[0]?.setStatus("reconnecting");
    await client.waitFor((m) => m.type === "status" && m.stt === "reconnecting");
  });

  it("ends the meeting and releases the slot when the socket closes without stop", async () => {
    const meetingId = newMeeting();
    await startSession(meetingId);
    client.sendFrames(2);
    await client.close();
    await waitUntil(() => harness.deps.repos.meetings.get(meetingId)?.status === "ended");
    expect(harness.deps.registry.size).toBe(0);
    expect(harness.providers[0]?.closed).toBe(true);
  });
});

describe("start validation", () => {
  it("replies MEETING_NOT_FOUND for unknown meetings", async () => {
    client.sendJson(startMessage("does-not-exist"));
    expect(await client.waitForType("error")).toMatchObject({ code: "MEETING_NOT_FOUND" });
  });

  it("allows only one active session per meeting", async () => {
    const meetingId = newMeeting();
    await startSession(meetingId);
    const other = await TestClient.connect(harness.port);
    other.sendJson(startMessage(meetingId));
    expect(await other.waitForType("error")).toMatchObject({ code: "BAD_MESSAGE" });
    await other.close();
  });

  it("refuses a second start on the same socket", async () => {
    const meetingId = newMeeting();
    await startSession(meetingId);
    client.sendJson(startMessage(meetingId));
    expect(await client.waitForType("error")).toMatchObject({ code: "BAD_MESSAGE" });
  });

  it("requires resume for a meeting that already has a recording", async () => {
    const meetingId = newMeeting();
    await startSession(meetingId);
    harness.providers[0]?.whenFrame(1, (p) =>
      p.emitFinal(fakeResult(0, "one two three four five six")),
    );
    client.sendFrames(1);
    await client.waitForType("segment");
    client.sendJson({ type: "stop" });
    await client.waitForType("stopped");

    client.sendJson(startMessage(meetingId));
    expect(await client.waitForType("error")).toMatchObject({ code: "BAD_MESSAGE" });
  });
});

describe("resume", () => {
  it("continues seq, appends to the wav and shifts timestamps by the recorded audio", async () => {
    const meetingId = newMeeting();
    await startSession(meetingId);
    harness.providers[0]?.whenFrame(1, (p) =>
      p.emitFinal(fakeResult(0, "first part of the meeting", 0, 500)),
    );
    client.sendFrames(2);
    await client.waitForType("segment");
    client.sendJson({ type: "stop" });
    await client.waitForType("stopped");
    client.messages.length = 0;

    await startSession(meetingId, { resume: true });
    harness.providers[1]?.whenFrame(1, (p) =>
      p.emitFinal(fakeResult(0, "second part of the meeting", 0, 500)),
    );
    client.sendFrames(1);
    const second = (await client.waitForType("segment")) as {
      segment: { seq: number; startMs: number };
    };
    expect(second.segment).toMatchObject({ seq: 1, startMs: 200 });
    client.sendJson({ type: "stop" });
    await client.waitForType("stopped");

    const wav = readFileSync(join(harness.audioDir, `${meetingId}.wav`));
    expect(wav.length).toBe(44 + 3 * FRAME_BYTES);
    expect(harness.deps.repos.meetings.get(meetingId)?.status).toBe("ended");
  });
});

describe("STT unavailable", () => {
  it("reports STT_UNAVAILABLE and status closed but still records audio", async () => {
    harness.setFakeOptions({ failOpenWith: "no network" });
    const meetingId = newMeeting();
    await startSession(meetingId);
    expect(await client.waitForType("error")).toMatchObject({ code: "STT_UNAVAILABLE" });
    expect(client.of("status").at(-1)).toMatchObject({ stt: "closed" });
    client.sendFrames(2);
    client.sendJson({ type: "stop" });
    await client.waitForType("stopped");
    const wav = join(harness.audioDir, `${meetingId}.wav`);
    expect(existsSync(wav)).toBe(true);
    expect(readFileSync(wav).length).toBe(44 + 2 * FRAME_BYTES);
  });

  it("surfaces a fatal provider error mid-session", async () => {
    await startSession(newMeeting());
    harness.providers[0]?.emitError("gave up", true);
    expect(await client.waitForType("error")).toMatchObject({ code: "STT_UNAVAILABLE" });
  });
});

describe("translation seam", () => {
  it("lets hooks receive segments and emit persisted translations", async () => {
    await client.close();
    await harness.close();
    harness = await createHarness({
      onSessionCreated: () => ({
        onFinalSegment: (segment, session) =>
          session.emitTranslation({
            segmentId: segment.id,
            seq: segment.seq,
            lang: "vi",
            text: "xin chào",
            provider: "fake",
            latencyMs: 12.4,
          }),
      }),
    });
    client = await TestClient.connect(harness.port);
    const meetingId = newMeeting();
    await startSession(meetingId);
    harness.providers[0]?.whenFrame(1, (p) =>
      p.emitFinal(fakeResult(0, "hello everyone and welcome back")),
    );
    client.sendFrames(1);
    const translation = await client.waitForType("translation");
    expect(translation).toMatchObject({
      lang: "vi",
      text: "xin chào",
      provider: "fake",
      latencyMs: 12,
    });
    expect(harness.deps.repos.translations.listByMeeting(meetingId)).toHaveLength(1);
  });
});

async function waitUntil(condition: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("waitUntil timed out");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
