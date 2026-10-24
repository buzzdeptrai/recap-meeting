import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

const RANGE = { from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" };

function seed() {
  const ctx = setup();
  const { repos } = ctx;
  const m = repos.meetings.create({ title: "Họp ngân sách" });
  repos.meetings.start(m.id);
  repos.meetings.end(m.id);
  const segment = repos.segments.insert({
    meetingId: m.id,
    seq: 0,
    channel: 0,
    lang: "vi",
    startMs: 0,
    endMs: 500,
    text: "Thảo luận ngân sách quý",
  });
  repos.translations.upsert({
    segmentId: segment.id,
    lang: "en",
    text: "Discuss quarterly budget",
    provider: "p",
    latencyMs: 1,
  });
  repos.marks.insert({ meetingId: m.id, kind: "conclusion", atMs: 10 });
  repos.usage.record({
    vendor: "gemini",
    service: "translate",
    model: "g",
    inputTokens: 1,
    outputTokens: 1,
    latencyMs: 1,
    status: "ok",
    costUsd: 2,
    meetingId: m.id,
    ts: "2026-10-05T01:00:00Z",
  });
  const other = repos.meetings.create({ title: "Họp khác" });
  return { ...ctx, m, other };
}

const listIds = (repos: ReturnType<typeof setup>["repos"], q?: string) =>
  repos.meetings.search({ q }).meetings.map((x) => x.id);

describe("meetings soft delete", () => {
  it("adds nullable deleted_at / deleted_by on a fresh database", () => {
    const { db } = setup();
    const columns = db.prepare("PRAGMA table_info(meetings)").all() as { name: string }[];
    expect(columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["deleted_at", "deleted_by"]),
    );
  });

  it("records who deleted the meeting and clears it on restore", () => {
    const { repos, db, m } = seed();
    repos.meetings.softDelete(m.id, "user-1");
    const row = () => db.prepare("SELECT deleted_by FROM meetings WHERE id = ?").pluck().get(m.id);
    expect(row()).toBe("user-1");
    repos.meetings.restore(m.id);
    expect(row()).toBeNull();
  });

  it("hides the meeting from get, list, search (title, transcript, translation) and counts", () => {
    const { repos, m, other } = seed();
    for (const q of ["ngan sach", "quarterly", "Họp"]) expect(listIds(repos, q)).toContain(m.id);
    const result = repos.meetings.softDelete(m.id, "user-1");
    expect(result).toMatchObject({ ok: true, meeting: { id: m.id } });

    expect(repos.meetings.get(m.id)).toBeUndefined();
    expect(repos.meetings.list().map((x) => x.id)).toEqual([other.id]);
    expect(repos.meetings.list({ includeDeleted: true })).toHaveLength(2);
    for (const q of ["ngan sach", "quarterly", "Họp ngân"])
      expect(listIds(repos, q)).not.toContain(m.id);
    const all = repos.meetings.search();
    expect(all.total).toBe(1);
    expect(all.counts).toMatchObject({ all: 1, ended: 0, draft: 1 });
    expect(all.totals.meetings).toBe(1);
  });

  it("keeps every related row and the usage numbers", () => {
    const { repos, db, m } = seed();
    const before = repos.usage.totals(RANGE);
    repos.meetings.softDelete(m.id);
    for (const table of ["segments", "translations", "marks", "usage_events"]) {
      expect(db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get(), table).toBe(1);
    }
    expect(repos.usage.totals(RANGE)).toEqual(before);
    expect(repos.usage.topMeetings(RANGE, 5)[0]).toMatchObject({
      meetingId: m.id,
      title: "Họp ngân sách",
    });
  });

  it("restores with all data back in lists and search", () => {
    const { repos, m } = seed();
    repos.meetings.softDelete(m.id);
    expect(repos.meetings.restore(m.id)).toMatchObject({ id: m.id, deletedAt: null });
    expect(repos.meetings.get(m.id)?.title).toBe("Họp ngân sách");
    expect(listIds(repos, "quarterly")).toEqual([m.id]);
    expect(repos.meetings.listDeleted().total).toBe(0);
    expect(repos.segments.listByMeeting(m.id)).toHaveLength(1);
  });

  it("lists deleted meetings newest deletion first with deletedAt", () => {
    const { repos, advance, m, other } = seed();
    repos.meetings.softDelete(m.id);
    advance(5_000);
    repos.meetings.softDelete(other.id);
    const page = repos.meetings.listDeleted();
    expect(page.total).toBe(2);
    expect(page.meetings.map((x) => x.id)).toEqual([other.id, m.id]);
    expect(page.meetings[0]?.deletedAt).toBeTruthy();
    expect(repos.meetings.listDeleted({ limit: 1, offset: 1 }).meetings[0]?.id).toBe(m.id);
  });

  it("refuses a live meeting and unknown ids", () => {
    const { repos, other } = seed();
    repos.meetings.start(other.id);
    expect(repos.meetings.softDelete(other.id)).toEqual({ ok: false, reason: "live" });
    expect(repos.meetings.get(other.id)).toBeDefined();
    expect(repos.meetings.softDelete("missing")).toEqual({ ok: false, reason: "not_found" });
    expect(repos.meetings.restore("missing")).toBeUndefined();
  });

  it("is idempotent: deleting twice keeps the first time, restoring a normal meeting is safe", () => {
    const { repos, advance, m, other } = seed();
    const first = repos.meetings.softDelete(m.id);
    advance(10_000);
    const second = repos.meetings.softDelete(m.id);
    expect(second).toEqual(first);
    expect(repos.meetings.restore(other.id)).toMatchObject({ id: other.id, deletedAt: null });
    repos.meetings.restore(m.id);
    expect(repos.meetings.restore(m.id)).toMatchObject({ id: m.id });
  });

  it("decides atomically: a live meeting is never stamped, a deleted one keeps its first time", () => {
    const { repos, db, advance, m, other } = seed();
    repos.meetings.start(other.id);
    expect(repos.meetings.softDelete(other.id)).toEqual({ ok: false, reason: "live" });
    const stamp = () =>
      db.prepare("SELECT deleted_at FROM meetings WHERE id = ?").pluck().get(other.id);
    expect(stamp()).toBeNull();
    const first = repos.meetings.softDelete(m.id);
    db.prepare("UPDATE meetings SET status = 'live' WHERE id = ?").run(m.id); // resumed after delete
    advance(10_000);
    const again = repos.meetings.softDelete(m.id);
    expect(again.ok && first.ok && again.meeting.deletedAt).toBe(
      first.ok && first.meeting.deletedAt,
    );
  });

  it("does not modify a deleted meeting through update paths", () => {
    const { repos, m } = seed();
    repos.meetings.softDelete(m.id);
    expect(repos.meetings.updateTitle(m.id, "Mới")).toBeUndefined();
    expect(repos.meetings.start(m.id)).toBeUndefined();
    repos.meetings.restore(m.id);
    expect(repos.meetings.get(m.id)).toMatchObject({ title: "Họp ngân sách", status: "ended" });
  });
});
