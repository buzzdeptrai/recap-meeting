import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

function withMeeting() {
  const ctx = setup();
  const meeting = ctx.repos.meetings.create({ title: "m" });
  return { ...ctx, meetingId: meeting.id };
}

describe("segments repository", () => {
  it("inserts, lists ordered by seq and computes nextSeq", () => {
    const { repos, meetingId } = withMeeting();
    expect(repos.segments.nextSeq(meetingId)).toBe(0);
    const base = { meetingId, lang: "en", startMs: 0, endMs: 1000 };
    repos.segments.insert({ ...base, seq: 1, channel: 1, text: "second" });
    const first = repos.segments.insert({ ...base, seq: 0, channel: 0, text: "first" });
    expect(first).toMatchObject({
      meetingId,
      seq: 0,
      channel: 0,
      text: "first",
      createdAt: expect.any(String),
    });
    expect(repos.segments.listByMeeting(meetingId).map((s) => s.text)).toEqual(["first", "second"]);
    expect(repos.segments.nextSeq(meetingId)).toBe(2);
  });

  it("rejects duplicate seq and unknown meeting", () => {
    const { repos, meetingId } = withMeeting();
    const seg = {
      meetingId,
      seq: 0,
      channel: 0 as const,
      lang: null,
      startMs: 0,
      endMs: 1,
      text: "a",
    };
    repos.segments.insert(seg);
    expect(() => repos.segments.insert(seg)).toThrow(/UNIQUE/);
    expect(() => repos.segments.insert({ ...seg, meetingId: "nope", seq: 1 })).toThrow(
      /FOREIGN KEY/,
    );
  });
});

describe("translations repository", () => {
  it("upserts per (segment, lang) and lists by meeting in seq order", () => {
    const { repos, meetingId } = withMeeting();
    const common = { meetingId, channel: 0 as const, lang: "en", startMs: 0, endMs: 1 };
    const s1 = repos.segments.insert({ ...common, seq: 1, text: "b" });
    const s0 = repos.segments.insert({ ...common, seq: 0, text: "a" });
    repos.translations.upsert({
      segmentId: s1.id,
      lang: "vi",
      text: "B",
      provider: "gemini",
      latencyMs: 900.4,
    });
    repos.translations.upsert({
      segmentId: s0.id,
      lang: "vi",
      text: "A?",
      provider: "gemini",
      latencyMs: 1,
    });
    repos.translations.upsert({
      segmentId: s0.id,
      lang: "vi",
      text: "A",
      provider: "openai",
      latencyMs: 2,
    });
    const list = repos.translations.listByMeeting(meetingId);
    expect(list.map((t) => [t.segmentId, t.text, t.provider])).toEqual([
      [s0.id, "A", "openai"],
      [s1.id, "B", "gemini"],
    ]);
    expect(list[1]?.latencyMs).toBe(900);
  });
});

describe("marks repository", () => {
  it("inserts and lists by time", () => {
    const { repos, meetingId } = withMeeting();
    repos.marks.insert({ meetingId, kind: "conclusion", atMs: 9000 });
    const early = repos.marks.insert({ meetingId, kind: "conclusion", atMs: 3000 });
    expect(early).toMatchObject({ meetingId, kind: "conclusion", atMs: 3000 });
    expect(repos.marks.list(meetingId).map((m) => m.atMs)).toEqual([3000, 9000]);
  });

  it("stores topic marks with labels, renames, clears and deletes", () => {
    const { repos, meetingId } = withMeeting();
    const topic = repos.marks.insert({
      meetingId,
      kind: "topic",
      atMs: 1000,
      label: "  Ngân sách ",
    });
    expect(topic).toMatchObject({ kind: "topic", label: "Ngân sách" });
    expect(repos.marks.insert({ meetingId, kind: "topic", atMs: 2000 }).label).toBeNull();

    expect(repos.marks.updateLabel(meetingId, topic.id, "Kế hoạch Q4")).toMatchObject({
      id: topic.id,
      label: "Kế hoạch Q4",
    });
    expect(repos.marks.updateLabel(meetingId, topic.id, "   ")?.label).toBeNull();
    expect(repos.marks.updateLabel(meetingId, "missing", "x")).toBeUndefined();
    expect(repos.marks.updateLabel("other-meeting", topic.id, "x")).toBeUndefined();

    expect(repos.marks.remove("other-meeting", topic.id)).toBe(false);
    expect(repos.marks.remove(meetingId, topic.id)).toBe(true);
    expect(repos.marks.remove(meetingId, topic.id)).toBe(false);
    expect(repos.marks.list(meetingId)).toHaveLength(1);
  });

  it("reports the latest change time across creation and rename", () => {
    const { repos, meetingId, advance } = withMeeting();
    expect(repos.marks.latestChangeAt(meetingId)).toBeNull();
    const mark = repos.marks.insert({ meetingId, kind: "topic", atMs: 0 });
    expect(repos.marks.latestChangeAt(meetingId)).toBe(mark.createdAt);
    advance(5000);
    repos.marks.updateLabel(meetingId, mark.id, "Mới");
    expect(Date.parse(repos.marks.latestChangeAt(meetingId) ?? "")).toBe(
      Date.parse(mark.createdAt) + 5000,
    );
  });
});

describe("segments latestCreatedAt", () => {
  it("is null when empty and the newest creation time otherwise", () => {
    const { repos, meetingId, advance } = withMeeting();
    expect(repos.segments.latestCreatedAt(meetingId)).toBeNull();
    const base = { meetingId, lang: "en", channel: 0 as const, startMs: 0, endMs: 1 };
    repos.segments.insert({ ...base, seq: 0, text: "a" });
    advance(1000);
    const later = repos.segments.insert({ ...base, seq: 1, text: "b" });
    expect(repos.segments.latestCreatedAt(meetingId)).toBe(later.createdAt);
  });
});
