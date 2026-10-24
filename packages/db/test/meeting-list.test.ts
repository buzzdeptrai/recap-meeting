import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { agendaPreview, isChangedSince, minutesStaleSql, titleSortKey } from "../src";
import { setup } from "./helpers";

const content = { summary: "s", topics: [], actionItems: [], openIssues: [] };

function seed() {
  const ctx = setup();
  const { repos, advance } = ctx;
  const meeting = (
    title: string,
    opts: { status?: "draft" | "ended"; lang?: "vi" | "en" | "multi"; agenda?: string } = {},
  ) => {
    advance(60_000);
    const m = repos.meetings.create({
      title,
      sourceLang: opts.lang ?? "vi",
      targetLang: "en",
      agenda: opts.agenda,
    });
    if (opts.status !== "draft") {
      repos.meetings.start(m.id);
      advance(30_000);
      repos.meetings.end(m.id);
    }
    return m;
  };
  const segment = (meetingId: string, seq: number, text: string) =>
    repos.segments.insert({ meetingId, seq, channel: 0, lang: "vi", startMs: 0, endMs: 1, text });
  return { ...ctx, meeting, segment };
}

describe("list filters", () => {
  it("filters by minutes state (none / vi / en / stale)", () => {
    const { repos, meeting, segment, advance } = seed();
    const none = meeting("none");
    const vi = meeting("vi");
    const en = meeting("en");
    const stale = meeting("stale");
    segment(stale.id, 0, "a");
    repos.minutes.upsert({ meetingId: vi.id, lang: "vi", content, source: "ai" });
    repos.minutes.upsert({ meetingId: en.id, lang: "en", content, source: "edited" });
    repos.minutes.upsert({ meetingId: stale.id, lang: "vi", content, source: "ai" });
    advance(1_000);
    segment(stale.id, 1, "later");
    const ids = (minutes: "none" | "vi" | "en" | "stale" | "need") =>
      repos.meetings.search({ minutes }).meetings.map((m) => m.id);
    expect(ids("none")).toEqual([none.id]);
    expect(ids("vi").sort()).toEqual([stale.id, vi.id].sort());
    expect(ids("en")).toEqual([en.id]);
    expect(ids("stale")).toEqual([stale.id]);
    expect(ids("need").sort()).toEqual([none.id, stale.id].sort());
  });

  it("filters by language and created range, and sorts", () => {
    const { repos, meeting, advance } = seed();
    const a = meeting("Bravo", { lang: "vi" });
    advance(86_400_000);
    const b = meeting("Álpha", { lang: "en" });
    const c = meeting("Đông", { lang: "multi" });
    const d = meeting("Charlie", { lang: "multi", status: "draft" });
    const ids = (o: Parameters<typeof repos.meetings.search>[0]) =>
      repos.meetings.search(o).meetings.map((m) => m.id);
    expect(ids({ lang: "multi" })).toEqual([d.id, c.id]);
    expect(ids({ from: b.createdAt })).toEqual([d.id, c.id, b.id]);
    expect(ids({ to: b.createdAt })).toEqual([a.id]);
    expect(ids({ sort: "oldest" })[0]).toBe(a.id);
    expect(ids({ sort: "name" })).toEqual([b.id, a.id, d.id, c.id]);
  });

  it("sorts by duration (nulls last)", () => {
    const { repos, meeting, advance } = seed();
    meeting("short");
    advance(100);
    const long = meeting("long");
    repos.meetings.end(long.id, undefined, 9_000_000);
    const ids = () => repos.meetings.search({ sort: "duration" }).meetings.map((m) => m.id);
    expect(ids()[0]).toBe(long.id);
  });

  it("counts statuses ignoring the status filter but honouring the others", () => {
    const { repos, meeting } = seed();
    meeting("a", { lang: "vi" });
    meeting("b", { lang: "vi", status: "draft" });
    meeting("c", { lang: "en" });
    const result = repos.meetings.search({ status: "draft", lang: "vi" });
    expect(result.counts).toEqual({ all: 2, draft: 1, live: 0, ended: 1 });
    expect(result.total).toBe(1);
    expect(result.totals.meetings).toBe(1);
  });

  it("totals: duration, this week, meetings that need minutes", () => {
    const { repos, meeting, advance, segment } = seed();
    const old = meeting("old");
    advance(10 * 86_400_000);
    const weekFrom = new Date(Date.parse(old.createdAt) + 9 * 86_400_000).toISOString();
    const fresh = meeting("fresh");
    const done = meeting("done");
    repos.minutes.upsert({ meetingId: done.id, lang: "vi", content, source: "ai" });
    meeting("draft", { status: "draft" });
    const { totals } = repos.meetings.search({ weekFrom });
    expect(totals).toEqual({ meetings: 4, durationMs: 90_000, thisWeek: 3, needMinutes: 2 });
    segment(done.id, 0, "x");
    advance(1);
    segment(done.id, 1, "y");
    expect(repos.meetings.search({ weekFrom }).totals.needMinutes).toBe(3);
    expect(fresh.id).toBeTruthy();
  });

  it("combines search text with filters", () => {
    const { repos, meeting, segment } = seed();
    const a = meeting("A", { lang: "vi" });
    const b = meeting("B", { lang: "en" });
    segment(a.id, 0, "giá hợp đồng");
    segment(b.id, 0, "giá cả");
    const hit = repos.meetings.search({ q: "gia", lang: "en" });
    expect(hit.meetings.map((m) => m.id)).toEqual([b.id]);
    expect(hit.counts.all).toBe(1);
  });
});

describe("marks.countByKind", () => {
  it("counts one kind inside [from, to) across meetings", () => {
    const { repos, meeting, advance } = seed();
    const a = meeting("A");
    const from = repos.marks.insert({ meetingId: a.id, kind: "conclusion", atMs: 1 }).createdAt;
    repos.marks.insert({ meetingId: a.id, kind: "topic", atMs: 2 });
    advance(60_000);
    const b = meeting("B");
    const last = repos.marks.insert({ meetingId: b.id, kind: "conclusion", atMs: 3 }).createdAt;
    expect(repos.marks.countByKind("conclusion", from, "9999-01-01T00:00:00.000Z")).toBe(2);
    expect(repos.marks.countByKind("conclusion", from, last)).toBe(1);
    expect(repos.marks.countByKind("topic", from, last)).toBe(1);
  });
});

describe("per-meeting extras", () => {
  it("returns counters, minutes badges, first conclusion (and no cost) and agenda preview", () => {
    const { repos, meeting, segment, advance } = seed();
    const m = meeting("M", { agenda: "\n- Chốt giá Q4\n- khác" });
    segment(m.id, 0, "một hai  ba");
    segment(m.id, 1, "bốn");
    repos.marks.insert({ meetingId: m.id, kind: "topic", atMs: 1, label: "Giá" });
    repos.marks.insert({ meetingId: m.id, kind: "conclusion", atMs: 900, label: "Giữ 345" });
    repos.marks.insert({ meetingId: m.id, kind: "conclusion", atMs: 500, label: "Ký Q4" });
    repos.minutes.upsert({ meetingId: m.id, lang: "vi", content, source: "ai" });
    advance(5_000);
    repos.minutes.upsert({ meetingId: m.id, lang: "en", content, source: "edited" });
    const noEvents = meeting("N");
    const [n, hit] = repos.meetings.search({}).meetings;
    expect(n?.id).toBe(noEvents.id);
    expect(n).toMatchObject({
      wordCount: 0,
      topicCount: 0,
      minutes: {},
    });
    expect(hit).toMatchObject({
      topicCount: 1,
      conclusionCount: 2,
      wordCount: 5,
      firstConclusion: "Ký Q4",
      agendaPreview: "Chốt giá Q4",
      hasMinutes: ["en", "vi"],
      minutes: { vi: { source: "ai", stale: false }, en: { source: "edited", stale: false } },
    });
    expect(hit).not.toHaveProperty("costUsd");
    advance(1);
    segment(m.id, 2, "mới");
    expect(repos.meetings.search({}).meetings[1]?.minutes.vi?.stale).toBe(true);
  });

  it("SQL staleness agrees with the shared TypeScript rule", () => {
    const { db, repos, meeting, segment, advance } = seed();
    const m = meeting("M");
    repos.minutes.upsert({ meetingId: m.id, lang: "vi", content, source: "ai" });
    const sqlStale = () =>
      db
        .prepare(`SELECT ${minutesStaleSql("mi")} AS s FROM minutes mi WHERE mi.meeting_id = ?`)
        .pluck()
        .get(m.id);
    const tsStale = () => {
      const gen = repos.minutes.get(m.id, "vi")?.generatedAt as string;
      return isChangedSince(gen, [
        repos.segments.latestCreatedAt(m.id),
        repos.marks.latestChangeAt(m.id),
      ]);
    };
    expect([sqlStale(), tsStale()]).toEqual([0, false]);
    advance(10);
    segment(m.id, 0, "x");
    expect([sqlStale(), tsStale()]).toEqual([1, true]);
    repos.minutes.upsert({ meetingId: m.id, lang: "vi", content, source: "ai" });
    expect([sqlStale(), tsStale()]).toEqual([0, false]);
    advance(10);
    const mark = repos.marks.insert({ meetingId: m.id, kind: "topic", atMs: 1, label: "t" });
    expect([sqlStale(), tsStale()]).toEqual([1, true]);
    repos.minutes.upsert({ meetingId: m.id, lang: "vi", content, source: "ai" });
    advance(10);
    repos.marks.updateLabel(m.id, mark.id, "renamed");
    expect([sqlStale(), tsStale()]).toEqual([1, true]);
  });
});

describe("helpers", () => {
  it("agendaPreview takes the first non-empty line", () => {
    expect(agendaPreview(null)).toBeUndefined();
    expect(agendaPreview("  \n1. Một\n2. Hai")).toBe("Một");
    expect(agendaPreview("x".repeat(300))?.length).toBe(160);
  });

  it("titleSortKey ignores case and tones, đ follows d", () => {
    const sorted = ["Đông", "dạ", "Zeta", "Ăn", "an"].sort((a, b) =>
      titleSortKey(a).localeCompare(titleSortKey(b)),
    );
    expect(sorted).toEqual(["Ăn", "an", "dạ", "Đông", "Zeta"]);
  });
});

describe("performance", () => {
  it("lists 2000 meetings with every aggregate in under 100 ms", () => {
    const { db, repos } = seed();
    const insertMeeting = db.prepare(
      `INSERT INTO meetings (id, title, status, source_lang, target_lang, created_at, duration_ms)
       VALUES (?, ?, ?, ?, 'vi', ?, ?)`,
    );
    const insertSeg = db.prepare(
      `INSERT INTO segments (id, meeting_id, seq, channel, lang, start_ms, end_ms, text, created_at)
       VALUES (?, ?, ?, 0, 'vi', 0, 1, 'một câu nói dài vừa phải trong cuộc họp', ?)`,
    );
    const insertMinutes = db.prepare(
      `INSERT INTO minutes (meeting_id, lang, content, source, generated_at, updated_at)
       VALUES (?, 'vi', '{}', 'ai', ?, ?)`,
    );
    const statuses = ["ended", "ended", "draft", "live"];
    db.transaction(() => {
      for (let i = 0; i < 2000; i++) {
        const at = new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString();
        insertMeeting.run(
          `m${i}`,
          `Cuộc họp ${i}`,
          statuses[i % 4],
          ["vi", "en", "multi"][i % 3],
          at,
          i * 1000,
        );
        for (let s = 0; s < 40; s++) {
          insertSeg.run(`s${i}-${s}`, `m${i}`, s, at);
        }
        if (i % 2 === 0) {
          const generated = i % 4 === 0 ? "2020-01-01T00:00:00.000Z" : at;
          insertMinutes.run(`m${i}`, generated, generated);
        }
      }
    })();
    const run = (o: Parameters<typeof repos.meetings.search>[0]) => {
      repos.meetings.search(o);
      const t0 = performance.now();
      const r = repos.meetings.search({ limit: 20, ...o });
      return { ms: performance.now() - t0, r };
    };
    for (const options of [
      {},
      { minutes: "stale" as const },
      { sort: "duration" as const },
      { sort: "name" as const },
      { q: "cuoc hop 19" },
    ]) {
      const { ms, r } = run(options);
      expect(r.meetings.length).toBeGreaterThan(0);
      if (process.env.LIST_PERF) console.info("perf", JSON.stringify(options), ms.toFixed(1));
      expect(ms, JSON.stringify(options)).toBeLessThan(100);
    }
  });
});
