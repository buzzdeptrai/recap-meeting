import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listMeetings } from "./meetings-service";
import { listMeetingsQuerySchema } from "./schemas";

let repos: Repositories;
vi.mock("./db", () => ({ getRepositories: () => repos }));

const content = { summary: "s", topics: [], actionItems: [], openIssues: [] };

beforeEach(() => {
  repos = createRepositories(openDatabase(IN_MEMORY));
});

describe("listMeetings", () => {
  it("returns every meeting with total and minutesLangs when no query", () => {
    const a = repos.meetings.create({ title: "A" });
    repos.meetings.create({ title: "B" });
    repos.minutes.upsert({ meetingId: a.id, lang: "vi", content, source: "ai" });
    const result = listMeetings();
    expect(result.total).toBe(2);
    expect(result.meetings.find((m) => m.id === a.id)).toMatchObject({
      title: "A",
      minutesLangs: ["vi"],
    });
    expect(result.meetings[0]).not.toHaveProperty("snippet");
    expect(result.meetings[0]).not.toHaveProperty("hasMinutes");
  });

  it("searches transcript text with a snippet, honouring status and paging", () => {
    const m = repos.meetings.create({ title: "Họp giá" });
    repos.meetings.start(m.id);
    repos.meetings.end(m.id);
    repos.segments.insert({
      meetingId: m.id,
      seq: 0,
      channel: 0,
      lang: "vi",
      startMs: 0,
      endMs: 1,
      text: "Đàm phán hợp đồng",
    });
    repos.meetings.create({ title: "Khác" });
    const hit = listMeetings({ q: "dam phan", status: "ended" });
    expect(hit.total).toBe(1);
    expect(hit.meetings[0]?.snippet).toBe("<mark>Đàm</mark> <mark>phán</mark> hợp đồng");
    expect(listMeetings({ q: "dam phan", status: "draft" }).total).toBe(0);
    expect(listMeetings({ q: "dam", limit: 1, offset: 1 })).toMatchObject({
      total: 1,
      meetings: [],
    });
  });
});

describe("listMeetingsQuerySchema", () => {
  it("applies defaults and treats blanks as absent", () => {
    expect(listMeetingsQuerySchema.parse({ q: "", status: "" })).toEqual({ limit: 20, offset: 0 });
    expect(
      listMeetingsQuerySchema.parse({ q: " hợp ", status: "live", limit: "5", offset: "10" }),
    ).toEqual({
      q: "hợp",
      status: "live",
      limit: 5,
      offset: 10,
    });
  });

  it("accepts the new filters", () => {
    expect(
      listMeetingsQuerySchema.parse({
        minutes: "stale",
        lang: "multi",
        range: "custom",
        from: "2026-10-01",
        to: "2026-10-22",
        sort: "duration",
      }),
    ).toMatchObject({ minutes: "stale", lang: "multi", range: "custom", sort: "duration" });
    expect(listMeetingsQuerySchema.safeParse({ sort: "cost" }).success).toBe(false);
  });

  it("rejects bad values", () => {
    for (const bad of [
      { status: "x" },
      { limit: "0" },
      { limit: "101" },
      { offset: "-1" },
      { limit: "abc" },
      { minutes: "x" },
      { lang: "auto" },
      { range: "yesterday" },
      { sort: "relevance" },
      { from: "2026-02-31" },
      { from: "2026-10-22", to: "2026-10-01" },
    ]) {
      expect(listMeetingsQuerySchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("listMeetings filters, counts and totals", () => {
  it("resolves range presets in Vietnam time and reports counts and totals", () => {
    repos.meetings.create({ title: "today" });
    const now = Date.now();
    const result = listMeetings({ range: "today", now });
    expect(result.total).toBe(1);
    expect(result.totals).toMatchObject({ meetings: 1, thisWeek: 1, needMinutes: 0 });
    expect(result.counts).toEqual({ all: 1, draft: 1, live: 0, ended: 0 });
    expect(listMeetings({ range: "today", now: now + 3 * 86_400_000 }).total).toBe(0);
    expect(listMeetings({ range: "7d", now: now + 3 * 86_400_000 }).total).toBe(1);
    expect(listMeetings({ from: "2000-01-01", to: "2000-01-02" }).total).toBe(0);
  });

  it("passes minutes/lang/sort through and keeps backward-compatible fields", () => {
    const a = repos.meetings.create({ title: "Bravo", sourceLang: "en", targetLang: "vi" });
    repos.meetings.create({ title: "Alpha", sourceLang: "vi", targetLang: "en" });
    repos.minutes.upsert({ meetingId: a.id, lang: "en", content, source: "edited" });
    const byName = listMeetings({ sort: "name" });
    expect(byName.meetings.map((m) => m.title)).toEqual(["Alpha", "Bravo"]);
    expect(listMeetings({ lang: "en" }).meetings.map((m) => m.title)).toEqual(["Bravo"]);
    const withEn = listMeetings({ minutes: "en" });
    expect(withEn.meetings[0]).toMatchObject({
      minutesLangs: ["en"],
      minutes: { en: { source: "edited", stale: false } },
      topicCount: 0,
    });
    expect(withEn.meetings[0]).not.toHaveProperty("costUsd");
    expect(listMeetings({ minutes: "none" }).meetings.map((m) => m.title)).toEqual(["Alpha"]);
  });
});
