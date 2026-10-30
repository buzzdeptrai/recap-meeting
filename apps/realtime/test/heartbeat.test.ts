import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createHarness, startMessage, TestClient, type Harness } from "./helpers";

const INTERVAL_MS = 40;
const WAIT_MS = 1_500;

let harness: Harness;
afterEach(async () => {
  await harness.close();
});

const until = async (condition: () => boolean) => {
  const deadline = Date.now() + WAIT_MS;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe("server heartbeat", () => {
  it("keeps a client that answers pings (the ws default) connected", async () => {
    harness = await createHarness({}, { heartbeatIntervalMs: INTERVAL_MS });
    const client = await TestClient.connect(harness.port);
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS * 6));
    expect(client.socket.readyState).toBe(WebSocket.OPEN);
    await client.close();
  });

  it("terminates a client that stops answering and ends its session", async () => {
    harness = await createHarness({}, { heartbeatIntervalMs: INTERVAL_MS });
    const meetingId = harness.deps.repos.meetings.create({ title: "Half-dead" }).id;
    const socket = new WebSocket(`ws://localhost:${harness.port}/ws`, { autoPong: false });
    await new Promise((resolve) => socket.once("open", resolve));
    socket.send(JSON.stringify(startMessage(meetingId)));
    await until(() => harness.deps.registry.activeMeetingIds().includes(meetingId));

    await until(() => harness.deps.registry.activeMeetingIds().length === 0);
    expect(harness.deps.repos.meetings.get(meetingId)?.status).toBe("ended");
    socket.terminate();
  });
});
