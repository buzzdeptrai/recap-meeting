import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAME_BYTES, FRAME_MS } from "@recap/core";
import { IN_MEMORY, createRepositories, openDatabase } from "@recap/db";
import { FakeSttProvider } from "@recap/stt";
import { AudioWriter } from "../src/audio/audio-writer";
import { MeetingSession } from "../src/session/meeting-session";

const FRAMES = 20;
const FIRST_END = "2026-10-25T03:02:53.000Z";

function setup() {
  const repos = createRepositories(openDatabase(IN_MEMORY));
  const meeting = repos.meetings.create({ title: "End" });
  const path = join(mkdtempSync(join(tmpdir(), "recap-end-")), "a.wav");
  const open = (append: boolean) =>
    new MeetingSession({
      meeting,
      repos,
      stt: new FakeSttProvider(),
      audio: AudioWriter.open(path, { append }),
      sink: () => undefined,
      baseMs: 0,
      sourceLang: "multi",
      targetLang: "vi",
    });
  return { repos, meeting, open };
}

describe("ending a meeting is idempotent", () => {
  it("a second end() keeps the first ended_at and duration", () => {
    const { repos, meeting } = setup();
    repos.meetings.start(meeting.id, "2026-10-25T02:58:18.000Z");
    repos.meetings.end(meeting.id, FIRST_END, 1000);
    const again = repos.meetings.end(meeting.id, "2026-10-25T03:04:03.000Z", 5000);
    expect(again?.endedAt).toBe(FIRST_END);
    expect(again?.durationMs).toBe(1000);
  });

  it("a resume that recorded no audio restores the original end", async () => {
    const { repos, meeting, open } = setup();
    const first = open(false);
    await first.start();
    for (let i = 0; i < FRAMES; i += 1) first.handleAudio(new Uint8Array(FRAME_BYTES));
    await first.stop("client");
    const ended = repos.meetings.get(meeting.id);
    expect(ended?.status).toBe("ended");

    const resumed = open(true);
    await resumed.start();
    expect(repos.meetings.get(meeting.id)?.status).toBe("live");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await resumed.stop("disconnect");

    const after = repos.meetings.get(meeting.id);
    expect(after?.status).toBe("ended");
    expect(after?.endedAt).toBe(ended?.endedAt);
    expect(after?.durationMs).toBe(FRAMES * FRAME_MS);
  });

  it("a resume that recorded audio moves the end and extends the duration", async () => {
    const { repos, meeting, open } = setup();
    const first = open(false);
    await first.start();
    first.handleAudio(new Uint8Array(FRAME_BYTES));
    await first.stop("client");
    const resumed = open(true);
    await resumed.start();
    resumed.handleAudio(new Uint8Array(FRAME_BYTES));
    await resumed.stop("client");
    expect(repos.meetings.get(meeting.id)?.durationMs).toBe(2 * FRAME_MS);
  });
});
