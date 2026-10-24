import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAME_BYTES } from "@recap/core";
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

describe("malformed input", () => {
  it.each([
    ["invalid json", "not json"],
    ["unknown type", JSON.stringify({ type: "explode" })],
    ["float offset", JSON.stringify({ type: "mark", kind: "conclusion", atMs: 1.5 })],
    ["negative offset", JSON.stringify({ type: "mark", kind: "conclusion", atMs: -1 })],
    ["missing fields", JSON.stringify({ type: "start" })],
  ])("replies BAD_MESSAGE and keeps the socket usable: %s", async (_name, payload) => {
    client.sendJson(payload);
    expect(await client.waitForType("error")).toMatchObject({ code: "BAD_MESSAGE" });
    client.sendJson({ type: "ping", t: 7 });
    expect(await client.waitForType("pong")).toEqual({ type: "pong", t: 7 });
  });

  it("rejects audio before ready, once", async () => {
    client.sendFrames(3);
    await client.waitForType("error");
    client.sendJson({ type: "ping", t: 1 });
    await client.waitForType("pong");
    expect(client.of("error")).toHaveLength(1);
    expect(client.of("error")[0]).toMatchObject({ code: "BAD_MESSAGE" });
  });

  it("rejects mark and stop without a session", async () => {
    client.sendJson({ type: "mark", kind: "conclusion", atMs: 5 });
    client.sendJson({ type: "stop" });
    await client.waitFor(() => client.of("error").length === 2);
    expect(client.of("error").every((e) => e.code === "BAD_MESSAGE")).toBe(true);
  });

  it("drops and counts wrong-size frames without crashing the session", async () => {
    const meetingId = harness.deps.repos.meetings.create({ title: "m" }).id;
    client.sendJson(startMessage(meetingId));
    await client.waitForType("ready");
    client.sendFrames(1, FRAME_BYTES - 2);
    client.sendFrames(2, 10);
    client.sendFrames(2);
    client.sendJson({ type: "ping", t: 2 });
    await client.waitForType("pong");
    expect(client.of("error")).toHaveLength(1);
    expect(harness.providers[0]?.frames).toHaveLength(2);
    client.sendJson({ type: "stop" });
    await client.waitForType("stopped");
  });

  it("works for pings while a session is starting", async () => {
    const meetingId = harness.deps.repos.meetings.create({ title: "m" }).id;
    client.sendJson(startMessage(meetingId));
    client.sendJson({ type: "ping", t: 3 });
    await client.waitForType("pong");
    await client.waitForType("ready");
  });
});
