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

const sttStates = () => client.of("status").map((m) => m.stt);
const codes = () => client.of("error").map((m) => m.code);

describe("stt_retry over the WebSocket", () => {
  it("is refused with NOT_RECORDING before start", async () => {
    client.sendJson({ type: "stt_retry" });
    await client.waitForType("error");
    expect(codes()).toEqual(["NOT_RECORDING"]);
  });

  it("restarts a closed provider and reports the status transition", async () => {
    const meetingId = harness.deps.repos.meetings.create({ title: "Retry" }).id;
    client.sendJson(startMessage(meetingId));
    await client.waitForType("ready");
    const provider = harness.providers[0];
    provider?.setStatus("closed");
    await client.waitFor((m) => m.type === "status" && m.stt === "closed");

    client.sendJson({ type: "stt_retry" });
    await client.waitFor((m) => m.type === "status" && m.stt === "open" && sttStates().length > 2);
    expect(sttStates().slice(-2)).toEqual(["closed", "open"]);
    expect(codes()).toEqual([]);

    client.sendJson({ type: "stt_retry" });
    await client.waitForType("error");
    expect(codes()).toEqual(["STT_ALREADY_OPEN"]);
  });
});
