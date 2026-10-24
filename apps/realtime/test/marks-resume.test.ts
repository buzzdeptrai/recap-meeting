import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakeResult } from "@recap/stt";
import { createHarness, startMessage, TestClient, type Harness } from "./helpers";

const FRAME_MS = 100;
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

const newMeeting = () => harness.deps.repos.meetings.create({ title: "Marks" }).id;

async function startSession(meetingId: string, extra: Record<string, unknown> = {}) {
  client.sendJson(startMessage(meetingId, extra));
  await client.waitForType("ready");
}

async function stopSession() {
  client.sendJson({ type: "stop" });
  await client.waitForType("stopped");
}

describe("topic marks", () => {
  it("persists a labelled topic and echoes it with label", async () => {
    const meetingId = newMeeting();
    await startSession(meetingId);
    client.sendJson({ type: "mark", kind: "topic", atMs: 2500, label: "Ngân sách" });
    const echo = (await client.waitForType("mark")) as { mark: Record<string, unknown> };
    expect(echo.mark).toMatchObject({ kind: "topic", atMs: 2500, label: "Ngân sách" });
    expect(harness.deps.repos.marks.list(meetingId)).toMatchObject([
      { kind: "topic", atMs: 2500, label: "Ngân sách" },
    ]);
  });

  it("keeps conclusion marks working and label null by default", async () => {
    await startSession(newMeeting());
    client.sendJson({ type: "mark", kind: "conclusion", atMs: 10 });
    const echo = (await client.waitForType("mark")) as { mark: Record<string, unknown> };
    expect(echo.mark).toMatchObject({ kind: "conclusion", label: null });
  });

  it("renames via mark_label (echo = upsert) and clears with empty label", async () => {
    const meetingId = newMeeting();
    await startSession(meetingId);
    client.sendJson({ type: "mark", kind: "topic", atMs: 0 });
    const created = (await client.waitForType("mark")) as { mark: { id: string } };
    client.messages.length = 0;

    client.sendJson({ type: "mark_label", id: created.mark.id, label: "Lịch trình" });
    const renamed = (await client.waitForType("mark")) as { mark: Record<string, unknown> };
    expect(renamed.mark).toMatchObject({ id: created.mark.id, label: "Lịch trình" });
    expect(harness.deps.repos.marks.get(created.mark.id)?.label).toBe("Lịch trình");

    client.sendJson({ type: "mark_label", id: created.mark.id, label: "" });
    await client.waitFor((m) => m.type === "mark" && m.mark.label === null);
    expect(harness.deps.repos.marks.get(created.mark.id)?.label).toBeNull();
  });

  it("deletes via unmark and reports unknown ids as BAD_MESSAGE", async () => {
    const meetingId = newMeeting();
    await startSession(meetingId);
    client.sendJson({ type: "mark", kind: "topic", atMs: 0 });
    const created = (await client.waitForType("mark")) as { mark: { id: string } };

    client.sendJson({ type: "unmark", id: created.mark.id });
    expect(await client.waitForType("unmark")).toEqual({ type: "unmark", id: created.mark.id });
    expect(harness.deps.repos.marks.list(meetingId)).toEqual([]);

    client.sendJson({ type: "unmark", id: created.mark.id });
    expect(await client.waitForType("error")).toMatchObject({ code: "BAD_MESSAGE" });
    client.sendJson({ type: "mark_label", id: "nope", label: "x" });
    await client.waitFor((m) => m.type === "error" && m.message === "Unknown mark");
  });

  it("cannot touch another meeting's marks", async () => {
    const other = newMeeting();
    const foreign = harness.deps.repos.marks.insert({ meetingId: other, kind: "topic", atMs: 1 });
    await startSession(newMeeting());
    client.sendJson({ type: "unmark", id: foreign.id });
    expect(await client.waitForType("error")).toMatchObject({ code: "BAD_MESSAGE" });
    expect(harness.deps.repos.marks.get(foreign.id)).toBeDefined();
  });

  it("rejects a label over 120 characters", async () => {
    await startSession(newMeeting());
    client.sendJson({ type: "mark", kind: "topic", atMs: 0, label: "x".repeat(121) });
    expect(await client.waitForType("error")).toMatchObject({ code: "BAD_MESSAGE" });
  });
});

describe("resuming an ended meeting", () => {
  it("goes live again, keeps startedAt, clears end fields and sums audio on end", async () => {
    const { meetings } = harness.deps.repos;
    const meetingId = newMeeting();
    await startSession(meetingId);
    harness.providers[0]?.whenFrame(1, (p) =>
      p.emitFinal(fakeResult(0, "first part of the meeting today", 0, 300)),
    );
    client.sendFrames(3);
    await client.waitForType("segment");
    await stopSession();

    const first = meetings.get(meetingId);
    expect(first).toMatchObject({ status: "ended", durationMs: 3 * FRAME_MS });
    expect(first?.endedAt).toBeTruthy();

    client.messages.length = 0;
    await startSession(meetingId, { resume: true });
    const live = meetings.get(meetingId);
    expect(live).toMatchObject({ status: "live", endedAt: null, durationMs: null });
    expect(live?.startedAt).toBe(first?.startedAt);
    expect(client.of("ready")[0]).toMatchObject({
      startedAt: first?.startedAt,
      baseMs: 3 * FRAME_MS,
    });

    client.sendFrames(2);
    client.sendJson({ type: "mark", kind: "topic", atMs: 300 });
    await client.waitForType("mark");
    await stopSession();
    expect(meetings.get(meetingId)).toMatchObject({ status: "ended", durationMs: 5 * FRAME_MS });
    expect(harness.deps.repos.marks.list(meetingId)).toHaveLength(1);
  });
});
