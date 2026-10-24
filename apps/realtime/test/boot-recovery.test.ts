import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FRAME_BYTES } from "@recap/core";
import { fakeResult } from "@recap/stt";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AudioWriter, wavPathFor } from "../src/audio/audio-writer";
import { recoverInterruptedMeetings } from "../src/boot-recovery";
import { createHarness, startMessage, TestClient, type Harness } from "./helpers";

const FRAME_MS = 100;
const CRASHED_FRAMES = 3;
let harness: Harness;

beforeEach(async () => {
  harness = await createHarness();
});
afterEach(async () => {
  await harness.close();
});

/** A meeting whose process died: status live, a WAV with audio and one segment, no end(). */
function crashedMeeting(): string {
  const { repos } = harness.deps;
  const id = repos.meetings.create({ title: "Crashed" }).id;
  repos.meetings.start(id);
  const writer = AudioWriter.open(wavPathFor(harness.audioDir, id));
  for (let i = 0; i < CRASHED_FRAMES; i++) writer.write(Buffer.alloc(FRAME_BYTES, 1));
  writer.close();
  repos.segments.insert({
    meetingId: id,
    seq: 0,
    channel: 0,
    lang: "en",
    startMs: 0,
    endMs: 200,
    text: "before the crash",
  });
  return id;
}

describe("boot recovery", () => {
  it("ends a meeting left live, with the recorded audio length, and logs ids only", () => {
    const id = crashedMeeting();
    const lines: string[] = [];
    const recovered = recoverInterruptedMeetings(harness.deps.repos, harness.audioDir, (l) =>
      lines.push(l),
    );
    expect(recovered).toEqual([id]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(id);
    expect(harness.deps.repos.meetings.get(id)).toMatchObject({
      status: "ended",
      durationMs: CRASHED_FRAMES * FRAME_MS,
    });
    expect(recoverInterruptedMeetings(harness.deps.repos, harness.audioDir, () => {})).toEqual([]);
  });

  it("accepts resume on a recovered meeting and appends with the right baseMs", async () => {
    const id = crashedMeeting();
    recoverInterruptedMeetings(harness.deps.repos, harness.audioDir, () => {});
    const client = await TestClient.connect(harness.port);
    client.sendJson(startMessage(id, { resume: true }));
    await client.waitForType("ready");
    harness.providers[0]?.whenFrame(1, (p) =>
      p.emitFinal(fakeResult(0, "after the restart we continue", 0, 500)),
    );
    client.sendFrames(1);
    const seg = (await client.waitForType("segment")) as {
      segment: { seq: number; startMs: number };
    };
    expect(seg.segment).toMatchObject({ seq: 1, startMs: CRASHED_FRAMES * FRAME_MS });
    client.sendJson({ type: "stop" });
    await client.waitForType("stopped");
    await client.close();
    const wav = readFileSync(join(harness.audioDir, `${id}.wav`));
    expect(wav.length).toBe(44 + (CRASHED_FRAMES + 1) * FRAME_BYTES);
    expect(harness.deps.repos.meetings.get(id)?.durationMs).toBe((CRASHED_FRAMES + 1) * FRAME_MS);
  });
});
