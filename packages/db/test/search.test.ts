import { describe, expect, it } from "vitest";
import { buildFtsQuery } from "../src";
import { setup } from "./helpers";

function seed() {
  const ctx = setup();
  const { repos, advance } = ctx;
  const add = (title: string, lines: string[], status: "draft" | "ended" = "ended") => {
    advance(1_000);
    const m = repos.meetings.create({ title });
    if (status === "ended") {
      repos.meetings.start(m.id);
      repos.meetings.end(m.id);
    }
    lines.forEach((text, seq) =>
      repos.segments.insert({
        meetingId: m.id,
        seq,
        channel: 0,
        lang: "vi",
        startMs: seq * 1000,
        endMs: seq * 1000 + 500,
        text,
      }),
    );
    return m;
  };
  return { ...ctx, add };
}

describe("buildFtsQuery", () => {
  it("quotes words as prefix terms and drops syntax characters", () => {
    expect(buildFtsQuery('giá "345" OR -x* NEAR(')).toBe('"giá"* "345"* "OR"* "x"* "NEAR"*');
    expect(buildFtsQuery("!!! ()")).toBeNull();
  });
});

describe("meetings.search", () => {
  it("lists newest first without q, with total and pagination", () => {
    const { repos, add } = seed();
    const a = add("A", []);
    const b = add("B", []);
    const c = add("C", []);
    const page1 = repos.meetings.search({ limit: 2 });
    expect(page1.total).toBe(3);
    expect(page1.meetings.map((m) => m.id)).toEqual([c.id, b.id]);
    expect(repos.meetings.search({ limit: 2, offset: 2 }).meetings.map((m) => m.id)).toEqual([
      a.id,
    ]);
    expect(repos.meetings.search({ q: "   " }).total).toBe(3);
  });

  it("matches ignoring diacritics, in both directions", () => {
    const { repos, add } = seed();
    const m = add("Giao ban", ["Chúng ta họp vào thứ hai"]);
    expect(repos.meetings.search({ q: "hop" }).meetings.map((x) => x.id)).toEqual([m.id]);
    expect(repos.meetings.search({ q: "HỌP" }).meetings).toHaveLength(1);
    expect(repos.meetings.search({ q: "thu hai" }).meetings).toHaveLength(1);
  });

  it("matches prefixes, all words required, and title", () => {
    const { repos, add } = seed();
    const price = add("Báo giá Q4", ["Giữ giá 345 nếu ký trong quý"]);
    add("Khác", ["Nói về lương"]);
    expect(repos.meetings.search({ q: "gi" }).meetings.map((m) => m.id)).toEqual([price.id]);
    expect(repos.meetings.search({ q: "giữ 345" }).meetings).toHaveLength(1);
    expect(repos.meetings.search({ q: "giữ lương" }).meetings).toHaveLength(0);
    expect(repos.meetings.search({ q: "q4" }).meetings.map((m) => m.id)).toEqual([price.id]);
  });

  it("returns an escaped highlighted snippet from transcript hits only", () => {
    const { repos, add } = seed();
    const m = add("Họp", ["Mức <b>giá</b> & phí cần chốt"]);
    const [hit] = repos.meetings.search({ q: "giá" }).meetings;
    expect(hit?.id).toBe(m.id);
    expect(hit?.snippet).toBe("Mức &lt;b&gt;<mark>giá</mark>&lt;/b&gt; &amp; phí cần chốt");
    expect(repos.meetings.search({ q: "Họp" }).meetings[0]?.snippet).toBeUndefined();
  });

  it("searches translations and follows later edits and deletes", () => {
    const { repos, add } = seed();
    const m = add("Họp", ["Chốt giá"]);
    const seg = repos.segments.listByMeeting(m.id)[0]!;
    repos.translations.upsert({
      segmentId: seg.id,
      lang: "en",
      text: "Lock the price",
      provider: "t",
      latencyMs: 1,
    });
    expect(repos.meetings.search({ q: "price" }).meetings).toHaveLength(1);
    repos.meetings.updateTitle(m.id, "Đổi tên");
    expect(repos.meetings.search({ q: "doi ten" }).meetings).toHaveLength(1);
    repos.meetings.remove(m.id);
    expect(repos.meetings.search({ q: "price" }).total).toBe(0);
    expect(repos.meetings.search({ q: "doi" }).total).toBe(0);
  });

  it("never throws on hostile input", () => {
    const { repos, add } = seed();
    add("x", ["a"]);
    for (const q of [
      '"',
      "'",
      "*",
      "AND",
      "a OR",
      "(",
      "col:x",
      "-",
      "^a",
      "NEAR(a b)",
      "\\",
      "%_",
    ]) {
      expect(() => repos.meetings.search({ q })).not.toThrow();
    }
    expect(repos.meetings.search({ q: "?!" })).toMatchObject({ meetings: [], total: 0 });
  });

  it("filters by status and ranks stronger matches first", () => {
    const { repos, add } = seed();
    const weak = add("Một", ["giá giá"]);
    const strong = add("Hai", ["giá giá giá giá giá"], "draft");
    add("Ba", ["không liên quan"]);
    expect(repos.meetings.search({ q: "giá" }).meetings).toHaveLength(2);
    expect(repos.meetings.search({ q: "giá", status: "draft" }).meetings.map((m) => m.id)).toEqual([
      strong.id,
    ]);
    expect(repos.meetings.search({ q: "giá", status: "ended" })).toMatchObject({ total: 1 });
    expect(repos.meetings.search({ status: "ended" }).meetings.map((m) => m.id)).toContain(weak.id);
  });

  it("paginates search results and reports total", () => {
    const { repos, add } = seed();
    for (let i = 0; i < 5; i++) add(`M${i}`, ["đàm phán hợp đồng"]);
    const p1 = repos.meetings.search({ q: "dam phan", limit: 2 });
    const p3 = repos.meetings.search({ q: "dam phan", limit: 2, offset: 4 });
    expect([p1.total, p1.meetings.length, p3.meetings.length]).toEqual([5, 2, 1]);
  });

  it("reports which languages have minutes", () => {
    const { repos, add } = seed();
    const m = add("Họp", ["xin chào"]);
    const content = { summary: "s", topics: [], actionItems: [], openIssues: [] };
    repos.minutes.upsert({ meetingId: m.id, lang: "en", content, source: "ai" });
    repos.minutes.upsert({ meetingId: m.id, lang: "vi", content, source: "ai" });
    expect(repos.meetings.search({ q: "chao" }).meetings[0]?.hasMinutes).toEqual(["en", "vi"]);
    expect(repos.meetings.search().meetings[0]?.hasMinutes).toEqual(["en", "vi"]);
  });
});

describe("migration 003 backfill", () => {
  it("indexes rows that existed before the migration", async () => {
    const { migrations, runMigrations, openDatabase, IN_MEMORY, createRepositories } =
      await import("../src");
    const db = openDatabase(IN_MEMORY, { migrate: false });
    runMigrations(
      db,
      migrations.filter((m) => m.version < 3),
    );
    // Raw SQL: repositories prepare statements for the newest schema and cannot run on old DBs.
    const m = { id: "old-meeting" };
    db.prepare(
      "INSERT INTO meetings (id, title, status, created_at) VALUES (?, 'Cũ', 'draft', '2026-01-01T00:00:00.000Z')",
    ).run(m.id);
    db.prepare(
      `INSERT INTO segments (id, meeting_id, seq, channel, lang, start_ms, end_ms, text, created_at)
       VALUES ('old-seg', ?, 0, 0, 'vi', 0, 1, 'nội dung cũ', '2026-01-01T00:00:00.000Z')`,
    ).run(m.id);
    runMigrations(db);
    const repos = createRepositories(db);
    expect(repos.meetings.search({ q: "noi dung" }).meetings.map((x) => x.id)).toEqual([m.id]);
    expect(repos.meetings.search({ q: "cu" }).total).toBe(1);
  });
});
