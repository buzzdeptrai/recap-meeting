import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { beforeEach, describe, expect, it } from "vitest";
import { summaryQuerySchema } from "./usage-range";
import {
  getBreakdown,
  getCsv,
  getSeries,
  getSummary,
  getTopMeetings,
  type UsageServiceDeps,
} from "./usage-service";

const MULTIPLIER = 5;
const NOW = Date.parse("2026-10-15T05:00:00Z");
let repos: Repositories;

const deps = (costMultiplier = MULTIPLIER): UsageServiceDeps => ({
  repos,
  now: () => NOW,
  budgetUsd: 60,
  pricing: { version: 1, currency: "USD", entries: [] },
  costMultiplier,
});

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

const range = summaryQuerySchema.parse({ from: "2026-10-02", to: "2026-10-15" });

beforeEach(() => {
  repos = createRepositories(openDatabase(IN_MEMORY));
});

describe("usage service with a display multiplier", () => {
  it("scales summary totals, previous period and budget but not counts or pctChange", () => {
    ev("2026-10-03T01:00:00Z", 6);
    ev("2026-09-20T01:00:00Z", 3);
    const s = getSummary(range, deps());
    expect(s.totals.costUsd).toBe(30);
    expect(s.previous.costUsd).toBe(15);
    expect(s.totals.inputTokens).toBe(100);
    expect(s.deltasPct.costUsd).toBeCloseTo(100);
    expect(s.budget.spentUsd).toBe(30);
    expect(s.budget.monthlyUsd).toBe(60);
    expect(s.budget.percentUsed).toBe(50);
    expect(s.budget.projectedUsd).toBeCloseTo((30 / 14.5) * 31, 1);
  });

  it("scales the cost series only", () => {
    ev("2026-10-03T01:00:00Z", 1);
    const cost = getSeries({ ...range, metric: "cost", groupBy: "vendor" }, deps());
    expect(cost.dayTotals.reduce((a, b) => a + b, 0)).toBe(5);
    const requests = getSeries({ ...range, metric: "requests", groupBy: "vendor" }, deps());
    expect(requests.dayTotals.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("scales breakdown rows, keeps costShare, scales top meetings", () => {
    const m = repos.meetings.create({ title: "Họp A" });
    ev("2026-10-03T01:00:00Z", 2, { meetingId: m.id });
    const b = getBreakdown({ ...range, groupBy: "meeting" }, deps());
    expect(b.rows.find((r) => r.key === m.id)).toMatchObject({ costUsd: 10, costShare: 1 });
    expect(getTopMeetings({ ...range, limit: 5 }, deps()).meetings[0]?.costUsd).toBe(10);
  });

  it("scales CSV cost for both day and breakdown groupings", () => {
    ev("2026-10-03T01:00:00Z", 2);
    const day = getCsv({ ...range, groupBy: "day" }, deps());
    expect(day).toContain("2026-10-03,2026-10-03,10,0,100,50,1,0,0");
    const vendor = getCsv({ ...range, groupBy: "vendor" }, deps());
    expect(vendor).toContain("gemini,gemini,10,");
  });

  it("multiplier 1 leaves figures untouched", () => {
    ev("2026-10-03T01:00:00Z", 2);
    expect(getSummary(range, deps(1)).totals.costUsd).toBe(2);
  });
});
