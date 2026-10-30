import { fakeResult, Segmenter } from "@recap/stt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHarness, startMessage, TestClient, type Harness } from "./helpers";

let harness: Harness;
let victim: TestClient;
let bystander: TestClient;
let victimMeeting: string;
let bystanderMeeting: string;

beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  harness = await createHarness();
  const { meetings } = harness.deps.repos;
  victimMeeting = meetings.create({ title: "Victim" }).id;
  bystanderMeeting = meetings.create({ title: "Bystander" }).id;
  victim = await TestClient.connect(harness.port);
  bystander = await TestClient.connect(harness.port);
  victim.sendJson(startMessage(victimMeeting));
  await victim.waitForType("ready");
  bystander.sendJson(startMessage(bystanderMeeting));
  await bystander.waitForType("ready");
});
afterEach(async () => {
  vi.restoreAllMocks();
  await victim.close();
  await bystander.close();
  await harness.close();
});

async function expectBystanderStillWorks() {
  expect(harness.deps.registry.activeMeetingIds()).toEqual([bystanderMeeting]);
  const before = bystander.of("mark").length;
  bystander.sendJson({ type: "mark", kind: "conclusion", atMs: 10 });
  await bystander.waitFor((m) => m.type === "mark" && bystander.of("mark").length > before);
  expect(bystander.of("error")).toEqual([]);
}

describe("per-session crash isolation", () => {
  it("an exception in an STT event handler ends only that session", async () => {
    vi.spyOn(Segmenter.prototype, "onFinal").mockImplementation(() => {
      throw new Error("boom in segmenter");
    });
    // Must not throw out of the provider's emit (that would be an uncaught exception).
    expect(() => harness.providers[0]?.emitFinal(fakeResult(0, "hello", 0, 500))).not.toThrow();

    const error = await victim.waitForType("error");
    expect(error).toMatchObject({ code: "INTERNAL" });
    await victim.waitForType("stopped");
    expect(harness.deps.repos.meetings.get(victimMeeting)?.status).toBe("ended");
    await expectBystanderStillWorks();
  });

  it("an exception in the audio path ends only that session, reported once", async () => {
    vi.spyOn(harness.providers[0]!, "sendAudio").mockImplementation(() => {
      throw new Error("provider socket exploded");
    });
    victim.sendFrames(3);
    await victim.waitForType("stopped");
    expect(victim.of("error").map((e) => e.code)).toEqual(["INTERNAL"]);
    await expectBystanderStillWorks();
  });

  it("the crashed meeting can be resumed afterwards", async () => {
    vi.spyOn(harness.providers[0]!, "sendAudio").mockImplementation(() => {
      throw new Error("boom");
    });
    victim.sendFrames(1);
    await victim.waitForType("stopped");
    victim.sendJson(startMessage(victimMeeting, { resume: true }));
    await victim.waitFor((m) => m.type === "ready" && victim.of("ready").length === 2);
    expect(harness.deps.registry.activeMeetingIds()).toContain(victimMeeting);
  });
});
