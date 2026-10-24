import { describe, expect, it } from "vitest";
import { percentile, type UsageRecordInput } from "../src";
import { setup } from "./helpers";

const RANGE = { from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" };

const gemini = (over: Partial<UsageRecordInput> = {}): UsageRecordInput => ({
  vendor: "gemini",
  service: "translate",
  model: "g",
  inputTokens: 100,
  outputTokens: 20,
  latencyMs: 300,
  status: "ok",
  costUsd: 0.001,
  ...over,
});

describe("usage repository", () => {
  it("records with defaults and migration 004 exists", () => {
    const { repos, db } = setup();
    const event = repos.usage.record(gemini());
    expect(event).toMatchObject({ requests: 1, status: "ok" });
    const row = db.prepare("SELECT * FROM usage_events").get() as Record<string, unknown>;
    expect(row).toMatchObject({ vendor: "gemini", requests: 1, meta: null });
  });

  it("returns zeros for empty ranges", () => {
    const { repos } = setup();
    expect(repos.usage.totals(RANGE)).toMatchObject({ requests: 0, costUsd: 0, errors: 0 });
    expect(repos.usage.aggregate({ ...RANGE, groupBy: "vendor" })).toEqual([]);
    expect(repos.usage.reliability(RANGE)).toEqual([]);
    expect(repos.usage.latencyPercentiles(RANGE, "vendor")).toEqual([]);
    expect(repos.usage.topMeetings(RANGE, 5)).toEqual([]);
  });

  it("aggregates by vendor/model/service with errors and fallbacks", () => {
    const { repos } = setup();
    repos.usage.record(gemini({ ts: "2026-10-05T01:00:00Z" }));
    repos.usage.record(gemini({ ts: "2026-10-05T02:00:00Z", status: "error", costUsd: null }));
    repos.usage.record({
      vendor: "openai",
      service: "translate",
      model: "o",
      inputTokens: 50,
      outputTokens: 10,
      status: "fallback",
      costUsd: 0.002,
      ts: "2026-10-05T02:00:01Z",
    });
    const byVendor = repos.usage.aggregate({ ...RANGE, groupBy: "vendor" });
    expect(byVendor.map((r) => r.key)).toEqual(["gemini", "openai"]);
    expect(byVendor[0]).toMatchObject({ requests: 2, errors: 1, inputTokens: 200, costUsd: 0.001 });
    expect(byVendor[1]).toMatchObject({ fallbacks: 1, requests: 1 });
    expect(repos.usage.aggregate({ ...RANGE, groupBy: "vendor", vendor: "openai" })).toHaveLength(
      1,
    );
    expect(repos.usage.aggregate({ ...RANGE, groupBy: "model" })).toHaveLength(2);
    expect(repos.usage.totals(RANGE)).toMatchObject({ requests: 3, errors: 1, fallbacks: 1 });
    expect(repos.usage.reliability(RANGE)[0]).toMatchObject({
      vendor: "gemini",
      errorRate: 0.5,
      fallbackRate: 0,
    });
  });

  it("buckets days in the requested time zone (default +07:00)", () => {
    const { repos } = setup();
    // 2026-10-05 18:30 UTC = 2026-10-06 01:30 in Ho Chi Minh, still Oct 5 in UTC.
    repos.usage.record(gemini({ ts: "2026-10-05T18:30:00Z" }));
    repos.usage.record(gemini({ ts: "2026-10-05T10:00:00Z" }));
    const local = repos.usage.aggregate({ ...RANGE, groupBy: "day" });
    expect(local.map((r) => [r.key, r.requests])).toEqual([
      ["2026-10-05", 1],
      ["2026-10-06", 1],
    ]);
    const utc = repos.usage.aggregate({ ...RANGE, groupBy: "day", tzOffsetMinutes: 0 });
    expect(utc.map((r) => [r.key, r.requests])).toEqual([["2026-10-05", 2]]);
    const series = repos.usage.dailySeries({ ...RANGE, groupBy: "vendor" });
    expect(series.map((r) => [r.day, r.key])).toEqual([
      ["2026-10-05", "gemini"],
      ["2026-10-06", "gemini"],
    ]);
  });

  it("treats `to` as exclusive and compares the previous period", () => {
    const { repos } = setup();
    repos.usage.record(gemini({ ts: "2026-10-10T00:00:00Z" }));
    repos.usage.record(gemini({ ts: "2026-10-09T23:59:59Z" }));
    const range = { from: "2026-10-10T00:00:00.000Z", to: "2026-10-11T00:00:00.000Z" };
    expect(repos.usage.totals(range).requests).toBe(1);
    expect(repos.usage.previousPeriodTotals(range).requests).toBe(1);
    expect(repos.usage.totals({ ...range, to: "2026-10-10T00:00:00.000Z" }).requests).toBe(0);
  });

  it("computes p50/p95 latency excluding errors", () => {
    const { repos } = setup();
    for (let ms = 100; ms <= 1000; ms += 100) {
      repos.usage.record(gemini({ latencyMs: ms, ts: "2026-10-05T01:00:00Z" }));
    }
    repos.usage.record(gemini({ latencyMs: 9999, status: "error", ts: "2026-10-05T01:00:00Z" }));
    expect(repos.usage.latencyPercentiles(RANGE, "vendor")).toEqual([
      { key: "gemini", count: 10, p50: 500, p95: 1000 },
    ]);
    expect(percentile([], 95)).toBe(0);
  });

  it("ranks top meetings by cost and keeps unassigned rows out", () => {
    const { repos } = setup();
    const a = repos.meetings.create({ title: "A" });
    const b = repos.meetings.create({ title: "B" });
    repos.usage.record(gemini({ meetingId: a.id, costUsd: 1, ts: "2026-10-05T01:00:00Z" }));
    repos.usage.record(gemini({ meetingId: b.id, costUsd: 3, ts: "2026-10-05T01:00:00Z" }));
    repos.usage.record(gemini({ costUsd: 9, ts: "2026-10-05T01:00:00Z" }));
    const top = repos.usage.topMeetings(RANGE, 5);
    expect(top.map((m) => [m.title, m.costUsd])).toEqual([
      ["B", 3],
      ["A", 1],
    ]);
    expect(repos.usage.topMeetings(RANGE, 1)).toHaveLength(1);
  });
});

describe("createUsageRecorder", () => {
  it("prices at write time and never throws", async () => {
    const { createUsageRecorder } = await import("../src");
    const { repos, db } = setup();
    const pricing = {
      version: 1 as const,
      currency: "USD" as const,
      entries: [
        {
          vendor: "gemini" as const,
          service: "translate" as const,
          model: "g",
          inputPer1M: 1,
          outputPer1M: 2,
          verified: true,
          source_url: "https://example.com",
          updated_at: "2026-10-22",
        },
      ],
    };
    const errors: string[] = [];
    const record = createUsageRecorder(repos.usage, pricing, (m) => errors.push(m));
    record({ ...gemini(), inputTokens: 1_000_000, outputTokens: 0 });
    expect(db.prepare("SELECT cost_usd FROM usage_events").pluck().get()).toBe(1);

    record({ ...gemini(), meetingId: "missing-meeting" }); // FK violation
    db.close();
    expect(() => record(gemini())).not.toThrow();
    expect(errors).toHaveLength(2);
    expect(errors.join(" ")).not.toMatch(/missing-meeting/);
  });
});
