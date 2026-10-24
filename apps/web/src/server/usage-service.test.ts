import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { beforeEach, describe, expect, it } from "vitest";
import { summaryQuerySchema, seriesQuerySchema, dayKeys } from "./usage-range";
import {
  csvCell,
  getBreakdown,
  getCsv,
  getReliability,
  getSeries,
  getSummary,
  getTopMeetings,
  type UsageServiceDeps,
} from "./usage-service";

let repos: Repositories;
const NOW = Date.parse("2026-10-15T05:00:00Z"); // 12:00 in Ho Chi Minh

function deps(): UsageServiceDeps {
  return {
    repos,
    now: () => NOW,
    budgetUsd: 60,
    pricing: { version: 1, currency: "USD", entries: [] },
  };
}

const ev = (ts: string, costUsd: number, over = {}) =>
  repos.usage.record({
    ts,
    vendor: "gemini",
    service: "translate",
    model: "g",
    inputTokens: 100,
    outputTokens: 50,
    latencyMs: 200,
    status: "ok",
    costUsd,
    ...over,
  });

const parseSummary = (q: Record<string, string>) => {
  const r = summaryQuerySchema.safeParse(q);
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};

beforeEach(() => {
  repos = createRepositories(openDatabase(IN_MEMORY));
});

describe("range parsing", () => {
  it("date-only from/to are local days, `to` inclusive", () => {
    const q = parseSummary({ from: "2026-10-01", to: "2026-10-02" });
    expect(q).toEqual({
      from: "2026-09-30T17:00:00.000Z",
      to: "2026-10-02T17:00:00.000Z",
      tzOffsetMinutes: 420,
    });
    expect(dayKeys(q)).toEqual(["2026-10-01", "2026-10-02"]);
  });

  it("accepts +HH:MM tz and rejects bad input", () => {
    expect(
      parseSummary({ from: "2026-10-01", to: "2026-10-01", tz: "+00:00" }).tzOffsetMinutes,
    ).toBe(0);
    expect(summaryQuerySchema.safeParse({ tz: "nope" }).success).toBe(false);
    expect(summaryQuerySchema.safeParse({ from: "2026-10-05", to: "2026-10-01" }).success).toBe(
      false,
    );
    expect(seriesQuerySchema.safeParse({ metric: "bogus" }).success).toBe(false);
  });
});

describe("usage service", () => {
  it("summary: empty database yields zeros, null deltas and a budget", () => {
    const s = getSummary(parseSummary({ from: "2026-10-01", to: "2026-10-15" }), deps());
    expect(s.totals.requests).toBe(0);
    expect(s.deltasPct.costUsd).toBeNull();
    expect(s.budget).toMatchObject({
      monthlyUsd: 60,
      spentUsd: 0,
      projectedUsd: 0,
      daysInMonth: 31,
    });
    expect(s.pricing.allVerified).toBe(false);
  });

  it("summary: deltas and month-end projection", () => {
    ev("2026-10-03T01:00:00Z", 6); // in the 14-day window
    ev("2026-09-20T01:00:00Z", 3); // previous period
    const s = getSummary(parseSummary({ from: "2026-10-02", to: "2026-10-15" }), deps());
    expect(s.totals.costUsd).toBe(6);
    expect(s.previous.costUsd).toBe(3);
    expect(s.deltasPct.costUsd).toBeCloseTo(100);
    // spent 6 over 14.2 elapsed days (Oct 1 00:00 local -> Oct 15 12:00 local) in a 31 day month
    expect(s.budget.spentUsd).toBe(6);
    expect(s.budget.projectedUsd).toBeCloseTo((6 / 14.5) * 31, 1);
  });

  it("series: zero-fills days and stacks by group", () => {
    ev("2026-10-02T01:00:00Z", 1);
    ev("2026-10-04T01:00:00Z", 2, { vendor: "openai", model: "o" });
    const r = getSeries(
      seriesQuerySchema.parse({ from: "2026-10-02", to: "2026-10-04", groupBy: "vendor" }),
      deps(),
    );
    expect(r.days).toEqual(["2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(r.series).toEqual([
      { key: "openai", values: [0, 0, 2], total: 2 },
      { key: "gemini", values: [1, 0, 0], total: 1 },
    ]);
    expect(r.dayTotals).toEqual([1, 0, 2]);
  });

  it("breakdown by meeting labels titles; reliability and top meetings work", () => {
    const m = repos.meetings.create({ title: "Họp A" });
    ev("2026-10-03T01:00:00Z", 2, { meetingId: m.id });
    ev("2026-10-03T01:00:01Z", 0, { status: "error", latencyMs: 900, costUsd: null });
    const q = parseSummary({ from: "2026-10-01", to: "2026-10-15" });
    const b = getBreakdown({ ...q, groupBy: "meeting" }, deps());
    expect(b.rows.find((r) => r.key === m.id)).toMatchObject({ label: "Họp A", costShare: 1 });
    expect(b.rows.find((r) => r.key === null)).toBeDefined();
    const rel = getReliability(q, deps());
    expect(rel.rows[0]).toMatchObject({ requests: 2, errors: 1, errorRate: 0.5 });
    expect(rel.rows[0]?.latency.p95Ms).toBe(200);
    expect(getTopMeetings({ ...q, limit: 5 }, deps()).meetings[0]).toMatchObject({
      title: "Họp A",
    });
  });

  it("csv escapes cells and neutralises formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK()")).toBe("'=HYPERLINK()");
    expect(csvCell(-1.5)).toBe("-1.5");
    ev("2026-10-03T01:00:00Z", 2);
    const csv = getCsv(
      { ...parseSummary({ from: "2026-10-01", to: "2026-10-15" }), groupBy: "day" },
      deps(),
    );
    expect(csv.split("\n")[0]).toBe(
      "key,label,cost_usd,audio_seconds,input_tokens,output_tokens,requests,errors,fallbacks",
    );
    expect(csv).toContain("2026-10-03,2026-10-03,2,0,100,50,1,0,0");
  });
});
