import { fakeResult } from "@recap/stt";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHarness, startMessage, TestClient, type Harness } from "./helpers";

let harness: Harness;
let client: TestClient;

beforeEach(async () => {
  harness = await createHarness();
  client = await TestClient.connect(harness.port);
  const meetingId = harness.deps.repos.meetings.create({ title: "Reconnect" }).id;
  client.sendJson(startMessage(meetingId));
  await client.waitForType("ready");
});
afterEach(async () => {
  await client.close();
  await harness.close();
});

const segmentTexts = () => client.of("segment").map((m) => m.segment.text);

describe("reconnect flush", () => {
  it("emits the unfinished tail of the dropped channel once, before the new socket starts", async () => {
    const stt = harness.providers[0]!;
    stt.whenFrame(1, (p) => p.emitInterim(fakeResult(1, "so we need to", 0, 600)));
    client.sendFrames(1);
    await client.waitFor((m) => m.type === "interim");
    expect(segmentTexts()).toEqual([]);

    stt.emitActivity(1, "reconnecting");
    await client.waitForType("segment");
    expect(segmentTexts()).toEqual(["so we need to"]);

    stt.emitActivity(1, "reconnecting"); // idempotent: nothing left to flush
    stt.emitActivity(0, "reconnecting");
    client.sendJson({ type: "mark", kind: "conclusion", atMs: 0 });
    await client.waitForType("mark");
    expect(segmentTexts()).toEqual(["so we need to"]);
  });

  it("leaves the other channel's pending words alone", async () => {
    const stt = harness.providers[0]!;
    stt.whenFrame(1, (p) => p.emitInterim(fakeResult(0, "still talking here", 0, 600)));
    client.sendFrames(1);
    await client.waitFor((m) => m.type === "interim");
    stt.emitActivity(1, "reconnecting");
    client.sendJson({ type: "mark", kind: "conclusion", atMs: 0 });
    await client.waitForType("mark");
    expect(segmentTexts()).toEqual([]);
  });
});
