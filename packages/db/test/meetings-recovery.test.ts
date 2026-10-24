import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

const SECOND_MS = 1_000;
const BOOT = "2026-10-21T12:00:00.000Z";

function liveMeeting(ctx: ReturnType<typeof setup>, title: string) {
  const { repos } = ctx;
  const id = repos.meetings.create({ title }).id;
  repos.meetings.start(id);
  return id;
}

function addSegment(ctx: ReturnType<typeof setup>, meetingId: string, seq: number, endMs: number) {
  ctx.repos.segments.insert({
    meetingId,
    seq,
    channel: 0,
    lang: "vi",
    startMs: 0,
    endMs,
    text: "x",
  });
}

describe("recoverLive", () => {
  it("uses boot time and zero duration when nothing was recorded", () => {
    const ctx = setup();
    const id = liveMeeting(ctx, "empty");
    expect(ctx.repos.meetings.recoverLive(BOOT)).toEqual([id]);
    expect(ctx.repos.meetings.get(id)).toMatchObject({
      status: "ended",
      endedAt: BOOT,
      durationMs: 0,
    });
  });

  it("uses the last segment time and the greatest segment end without audio info", () => {
    const ctx = setup();
    const id = liveMeeting(ctx, "talked");
    addSegment(ctx, id, 0, 4 * SECOND_MS);
    ctx.advance(10 * SECOND_MS);
    addSegment(ctx, id, 1, 9 * SECOND_MS);
    const lastAt = "2026-10-21T09:00:10.000Z";
    ctx.advance(60 * SECOND_MS);
    ctx.repos.meetings.recoverLive(BOOT);
    expect(ctx.repos.meetings.get(id)).toMatchObject({
      status: "ended",
      endedAt: lastAt,
      durationMs: 9 * SECOND_MS,
    });
  });

  it("prefers recorded audio length (resumed meetings)", () => {
    const ctx = setup();
    const id = liveMeeting(ctx, "resumed");
    addSegment(ctx, id, 0, 4 * SECOND_MS);
    ctx.repos.meetings.recoverLive(BOOT, (meetingId) => (meetingId === id ? 30_400.4 : undefined));
    expect(ctx.repos.meetings.get(id)?.durationMs).toBe(30_400);
  });

  it("is idempotent and leaves other meetings untouched", () => {
    const ctx = setup();
    const live = liveMeeting(ctx, "live");
    const draft = ctx.repos.meetings.create({ title: "draft" }).id;
    const endedId = liveMeeting(ctx, "ended");
    ctx.repos.meetings.end(endedId, "2026-10-21T09:05:00.000Z", 1234);
    const before = [draft, endedId].map((id) => ctx.repos.meetings.get(id));

    expect(ctx.repos.meetings.recoverLive(BOOT)).toEqual([live]);
    expect(ctx.repos.meetings.recoverLive(BOOT)).toEqual([]);
    expect([draft, endedId].map((id) => ctx.repos.meetings.get(id))).toEqual(before);
  });
});
