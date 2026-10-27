import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FRAME_BYTES } from "@recap/core";
import { fakeResult } from "@recap/stt";
import {
  DEFAULT_TRANSLATOR_CONFIG,
  FakeProvider,
  createTranslator,
  type FakeScript,
} from "@recap/translate";
import { afterEach, describe, expect, it } from "vitest";
import { createTranslationHook } from "../src/translation";
import { createHarness, startMessage, TestClient, type Harness } from "./helpers";

const WAV_HEADER_BYTES = 44;

let harness: Harness | undefined;
let client: TestClient | undefined;

afterEach(async () => {
  await client?.close();
  await harness?.close();
  harness = undefined;
  client = undefined;
});

function translatorWith(gemini: FakeScript, openai: FakeScript = {}) {
  return createTranslator(
    {
      ...DEFAULT_TRANSLATOR_CONFIG,
      providerOrder: ["gemini", "openai"], // scripts below treat gemini as the primary
      gemini: { apiKey: "unused", model: "fake" },
      openai: { apiKey: "unused", model: "fake" },
    },
    {
      providers: {
        gemini: new FakeProvider("gemini", gemini),
        openai: new FakeProvider("openai", openai),
      },
    },
  );
}

async function setup(gemini: FakeScript, openai?: FakeScript) {
  harness = await createHarness({
    onSessionCreated: createTranslationHook(translatorWith(gemini, openai)),
  });
  client = await TestClient.connect(harness.port);
  const meetingId = harness.deps.repos.meetings.create({ title: "E2E" }).id;
  client.sendJson(startMessage(meetingId));
  await client.waitForType("ready");
  return { meetingId, stt: harness.providers[0]!, repos: harness.deps.repos, ws: client };
}

describe("realtime end-to-end (fake STT + fake translation, real ws/sqlite/wav)", () => {
  it("streams interim, segment, translation in seq order and persists everything", async () => {
    const { meetingId, stt, repos, ws } = await setup({});
    stt
      .whenFrame(1, (p) => p.emitInterim(fakeResult(1, "we can hold", 0, 400)))
      .whenFrame(2, (p) =>
        p.emitFinal(fakeResult(1, "we can hold the price at 345", 0, 1000, "en")),
      )
      .whenFrame(3, (p) =>
        p.emitFinal(fakeResult(1, "if they sign this quarter", 1000, 2000, "en")),
      );
    ws.sendFrames(3);
    await ws.waitFor((m) => m.type === "interim");
    ws.sendJson({ type: "mark", kind: "conclusion", atMs: 900 });
    await ws.waitForType("mark");
    ws.sendJson({ type: "stop" });
    await ws.waitForType("stopped");

    const types = ws.messages.map((m) => m.type);
    expect(types.indexOf("interim")).toBeLessThan(types.indexOf("segment"));
    const segments = ws.of("segment").map((m) => m.segment);
    const translations = ws.of("translation");
    expect(segments.length).toBeGreaterThan(0);
    expect(translations.map((t) => t.seq)).toEqual(segments.map((s) => s.seq));
    expect(translations.every((t) => t.lang === "vi" && t.provider === "gemini")).toBe(true);
    expect(types.lastIndexOf("translation")).toBeLessThan(types.indexOf("stopped"));

    expect(repos.meetings.get(meetingId)?.status).toBe("ended");
    expect(repos.segments.listByMeeting(meetingId)).toHaveLength(segments.length);
    expect(repos.translations.listByMeeting(meetingId)).toHaveLength(translations.length);
    expect(repos.marks.list(meetingId)).toHaveLength(1);

    const wav = join(harness!.audioDir, `${meetingId}.wav`);
    expect(existsSync(wav)).toBe(true);
    const bytes = readFileSync(wav);
    expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString()).toBe("WAVE");
    expect(bytes.length).toBe(WAV_HEADER_BYTES + 3 * FRAME_BYTES);
  });

  it("shows provider failover in status", async () => {
    const { stt, ws } = await setup({ error: "SERVER" }, {});
    stt.whenFrame(1, (p) => p.emitFinal(fakeResult(1, "hold the price", 0, 1000, "en")));
    ws.sendFrames(1);
    ws.sendJson({ type: "stop" });
    await ws.waitForType("stopped");

    expect(ws.of("translation")[0]).toMatchObject({ provider: "openai" });
    const statuses = ws.of("status");
    expect(statuses.at(-1)?.translate).toEqual({ provider: "openai", degraded: true });
  });

  it("reports TRANSLATE_FAILED per segment without blocking later segments", async () => {
    const failBoom: FakeScript = (req) =>
      req.userPrompt.includes("boom") ? { error: "SERVER" } : { text: "ok" };
    const { stt, ws } = await setup(failBoom, failBoom);
    stt
      .whenFrame(1, (p) => p.emitFinal(fakeResult(1, "boom boom", 0, 1000, "en")))
      .whenFrame(2, (p) => p.emitFinal(fakeResult(0, "fine text here", 1000, 2000, "en")));
    ws.sendFrames(2);
    ws.sendJson({ type: "stop" });
    await ws.waitForType("stopped");

    const failed = ws.of("error").filter((e) => e.code === "TRANSLATE_FAILED");
    const segments = ws.of("segment").map((m) => m.segment);
    const boom = segments.find((s) => s.text.includes("boom"));
    expect(failed).toHaveLength(1);
    expect(failed[0]?.segmentId).toBe(boom?.id);
    expect(ws.of("translation").map((t) => t.text)).toEqual(["ok"]);
  });

  it("skips segments already in the target language", async () => {
    const { meetingId, stt, repos, ws } = await setup({});
    stt
      .whenFrame(1, (p) => p.emitFinal(fakeResult(1, "xin chào mọi người", 0, 1000, "vi")))
      .whenFrame(2, (p) => p.emitFinal(fakeResult(1, "good morning all", 1000, 2000, "en")));
    ws.sendFrames(2);
    ws.sendJson({ type: "stop" });
    await ws.waitForType("stopped");

    const translated = ws.of("translation");
    expect(translated).toHaveLength(1);
    const source = ws.of("segment").find((m) => m.segment.id === translated[0]?.segmentId);
    expect(source?.segment.lang).toBe("en");
    expect(repos.translations.listByMeeting(meetingId)).toHaveLength(1);
  });

  it("skips target-language text even when the provider reports no language", async () => {
    const { meetingId, stt, repos, ws } = await setup({});
    stt
      .whenFrame(1, (p) =>
        p.emitFinal(fakeResult(1, "bạn chế tạo được một loại nhiên liệu mới", 0, 1000)),
      )
      .whenFrame(2, (p) =>
        p.emitFinal(fakeResult(1, "feel free to continue with the plan", 1000, 2000)),
      );
    ws.sendFrames(2);
    ws.sendJson({ type: "stop" });
    await ws.waitForType("stopped");

    expect(ws.of("segment")).toHaveLength(2);
    expect(ws.of("translation")).toHaveLength(1);
    expect(ws.of("error")).toHaveLength(0);
    expect(repos.translations.listByMeeting(meetingId)).toHaveLength(1);
  });
});
