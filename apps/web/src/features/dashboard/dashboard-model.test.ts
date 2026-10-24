import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { beforeEach, describe, expect, it } from "vitest";
import type { MeetingListItemDto } from "@/lib/api-types";
import type { UsageServiceDeps } from "@/server/usage-service";
import { loadDashboard } from "./dashboard-data";
import {
  buildAttention,
  buildDashboardModel,
  countMeetings,
  hoursStat,
  toRecentRow,
} from "./dashboard-model";

let repos: Repositories;
const NOW = Date.parse("2026-10-15T05:00:00Z"); // 12:00 in Ho Chi Minh
const DAY = 86_400_000;

const deps = (): UsageServiceDeps => ({
  repos,
  now: () => NOW,
  budgetUsd: 60,
  pricing: { version: 1, currency: "USD", entries: [] },
});

const event = (ts: string, over = {}) =>
  repos.usage.record({
    ts,
    vendor: "deepgram",
    service: "stt_live",
    model: "nova-3",
    audioSeconds: 7200,
    latencyMs: 400,
    status: "ok",
    costUsd: 1.5,
    ...over,
  });

const meeting = (over: Partial<MeetingListItemDto> = {}): MeetingListItemDto => ({
  id: "m1",
  title: "Họp giá",
  status: "ended",
  sourceLang: "vi",
  targetLang: "en",
  agenda: null,
  createdAt: "2026-10-14T03:00:00.000Z",
  startedAt: "2026-10-14T03:00:00.000Z",
  endedAt: null,
  durationMs: 60_000,
  minutesLangs: ["vi"],
  minutes: { vi: { source: "ai", stale: false } },
  topicCount: 0,
  conclusionCount: 0,
  wordCount: 10,
  ...over,
});

beforeEach(() => {
  repos = createRepositories(openDatabase(IN_MEMORY));
});

describe("dashboard model", () => {
  it("is quiet (no invented numbers) when there are no meetings", () => {
    const model = buildDashboardModel(loadDashboard(NOW, deps(), {}));
    expect(model.quiet).toBe(true);
    expect(model.meetings).toEqual({ value: 0, delta: null });
    expect(model.hours.value).toBe("0");
    expect(model.attention).toEqual({ total: 0, items: [] });
    expect(model.services).toEqual([]);
    expect(model.chart.meetings.every((n) => n === 0)).toBe(true);
  });

  it("maps meetings into cards and chart series without any usage figures", () => {
    event("2026-10-10T03:00:00Z"); // usage exists but must not leak into the model
    const model = buildDashboardModel(
      loadDashboard(NOW, deps(), {
        meetings: [
          { createdAt: "2026-10-12T03:00:00Z", startedAt: null, durationMs: 5_400_000 },
          { createdAt: "2026-10-12T05:00:00Z", startedAt: null, durationMs: 1_800_000 },
        ],
        needMinutes: 3,
        conclusions: 4,
        recent: [meeting()],
      }),
    );
    expect(model.quiet).toBe(false);
    expect(model.monthText).toBe("tháng 10");
    expect(model.meetings.value).toBe(2);
    expect(model.hours).toMatchObject({ value: "2", unit: "giờ" });
    expect(model.needMinutes).toBe(3);
    expect(model.conclusions).toBe(4);
    expect(model.chart.labels[0]).toBe("1/10");
    expect(model.chart.labels).toHaveLength(15);
    expect(model.chart.meetings[11]).toBe(2);
    expect(model.chart.hours[11]).toBeCloseTo(2);
    expect(Object.keys(model).sort()).toEqual(
      [
        "attention",
        "chart",
        "conclusions",
        "hours",
        "meetings",
        "monthText",
        "needMinutes",
        "quiet",
        "recent",
        "services",
      ].sort(),
    );
    expect(JSON.stringify(model)).not.toMatch(/cost|token|usd/i);
  });

  it("rates services by error rate, grey without requests", () => {
    for (let i = 0; i < 9; i++) event("2026-10-10T03:00:00Z");
    event("2026-10-10T04:00:00Z", { status: "error" });
    const model = buildDashboardModel(loadDashboard(NOW, deps(), {}));
    expect(model.services[0]?.health.status).toBe("bad"); // 10% errors
  });
});

describe("countMeetings", () => {
  const range = {
    from: "2026-09-30T17:00:00.000Z",
    to: "2026-10-04T17:00:00.000Z",
    tzOffsetMinutes: 420,
  };
  const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];

  it("buckets by local day and counts the previous equal period", () => {
    const counts = countMeetings(
      [
        { createdAt: "2026-10-01T01:00:00Z", startedAt: null, durationMs: 1000 },
        { createdAt: "x", startedAt: "2026-10-01T20:00:00Z", durationMs: null }, // 03:00 on the 2nd
        { createdAt: "2026-09-28T01:00:00Z", startedAt: null, durationMs: 500 }, // previous period
        { createdAt: "2026-08-01T01:00:00Z", startedAt: null, durationMs: 9 }, // too old
      ],
      range,
      days,
    );
    expect(counts).toEqual({
      perDay: [1, 1, 0, 0],
      perDayMs: [1000, 0, 0, 0],
      current: 2,
      previous: 1,
      currentMs: 1000,
      previousMs: 500,
    });
  });
});

describe("hoursStat", () => {
  it("shows minutes under an hour, hours above, with a delta only when comparable", () => {
    expect(hoursStat(35 * 60_000, 0)).toEqual({ value: "35", unit: "phút", delta: null });
    expect(hoursStat(5_400_000, 3_600_000)).toMatchObject({
      value: "1,5",
      unit: "giờ",
      delta: { direction: "up" },
    });
    expect(hoursStat(0, 0).value).toBe("0");
  });
});

describe("buildAttention", () => {
  it("ranks missing minutes, stale minutes, old drafts, empty meetings; skips healthy ones", () => {
    const ended = [
      meeting({ id: "ok" }),
      meeting({ id: "empty", wordCount: 0, minutesLangs: [], minutes: {} }),
      meeting({ id: "stale", minutes: { vi: { source: "ai", stale: true } } }),
      meeting({ id: "none", minutesLangs: [], minutes: {} }),
      meeting({ id: "live", status: "live" }),
    ];
    const drafts = [
      meeting({ id: "old", status: "draft", createdAt: new Date(NOW - 9 * DAY).toISOString() }),
      meeting({ id: "new", status: "draft", createdAt: new Date(NOW - DAY).toISOString() }),
    ];
    const att = buildAttention(ended, drafts, NOW);
    expect(att.items.map((i) => [i.id, i.kind])).toEqual([
      ["none", "no-minutes"],
      ["stale", "stale"],
      ["old", "old-draft"],
      ["empty", "empty"],
    ]);
    expect(att.items[0]?.href).toBe("/meetings/none/minutes");
    expect(att.items[2]?.reason).toContain("9 ngày");
    expect(att.total).toBe(4);
  });

  it("caps the visible rows but keeps the full total", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      meeting({ id: `n${i}`, minutesLangs: [], minutes: {} }),
    );
    const att = buildAttention(many, [], NOW);
    expect(att.items).toHaveLength(5);
    expect(att.total).toBe(8);
  });
});

describe("toRecentRow", () => {
  it("links finished meetings with minutes to the minutes page", () => {
    expect(toRecentRow(meeting()).href).toBe("/meetings/m1/minutes");
    expect(toRecentRow(meeting()).status).toBe("ended");
    expect(toRecentRow(meeting()).minutesLangs).toEqual(["VI"]);
  });

  it("links live and unfinished meetings to the room", () => {
    const live = toRecentRow(meeting({ status: "live", minutesLangs: [] }));
    expect(live.href).toBe("/meetings/m1");
    expect(live.status).toBe("live");
    expect(toRecentRow(meeting({ minutesLangs: [] })).minutesLangs).toEqual([]);
  });
});
