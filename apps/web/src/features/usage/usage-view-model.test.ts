import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { beforeEach, describe, expect, it } from "vitest";
import type { UsageServiceDeps } from "@/server/usage-service";
import { loadUsagePage } from "./usage-data";
import { buildUsageViewModel } from "./usage-view-model";
import { DEFAULT_STATE } from "./usage-url";

let repos: Repositories;
const NOW = Date.parse("2026-10-15T05:00:00Z");

const deps = (verified = false): UsageServiceDeps => ({
  repos,
  now: () => NOW,
  budgetUsd: 60,
  pricing: {
    version: 1,
    currency: "USD",
    entries: [
      {
        vendor: "deepgram",
        service: "stt_live",
        model: "nova-3",
        audioPerMinute: 0.005,
        verified,
        source_url: "https://example.com",
        updated_at: "2026-10-01",
      },
    ],
  },
});

const event = (ts: string, over = {}) =>
  repos.usage.record({
    ts,
    vendor: "deepgram",
    service: "stt_live",
    model: "nova-3",
    audioSeconds: 600,
    latencyMs: 300,
    status: "ok",
    costUsd: 0.05,
    ...over,
  });

beforeEach(() => {
  repos = createRepositories(openDatabase(IN_MEMORY));
});

describe("usage view model", () => {
  it("is empty and honest without events", () => {
    const vm = buildUsageViewModel(loadUsagePage(DEFAULT_STATE, NOW, deps()), DEFAULT_STATE);
    expect(vm.empty).toBe(true);
    expect(vm.chart.total).toBe(0);
    expect(vm.chart.delta).toBeNull();
    expect(vm.breakdown).toEqual([]);
  });

  it("builds the chart per group and labels unverified prices as examples", () => {
    event("2026-10-10T03:00:00Z");
    event("2026-10-10T04:00:00Z", {
      vendor: "gemini",
      service: "translate",
      model: "g",
      audioSeconds: null,
      costUsd: 0.01,
      inputTokens: 10,
      outputTokens: 5,
    });
    const state = { ...DEFAULT_STATE, metric: "cost" } as const;
    const vm = buildUsageViewModel(loadUsagePage(state, NOW, deps()), state);
    expect(vm.estimated).toBe(true);
    expect(vm.chart.title).toBe("Chi phí (ví dụ)");
    expect(vm.chart.total).toBeCloseTo(0.06);
    expect(vm.chart.series.map((s) => s.label)).toEqual(["Deepgram", "Gemini"]);
    expect(vm.chart.series[0]?.values).toHaveLength(15);
    expect(vm.breakdown.map((r) => r.label)).toEqual(["Deepgram", "Gemini"]);
    expect(vm.reliability[0]).toMatchObject({ vendor: "Deepgram", requests: 1, p95Ms: 300 });
  });

  it("regroups by model and switches metric from the URL state", () => {
    event("2026-10-10T03:00:00Z");
    const state = { ...DEFAULT_STATE, group: "model", metric: "seconds" } as const;
    const vm = buildUsageViewModel(loadUsagePage(state, NOW, deps(true)), state);
    expect(vm.estimated).toBe(false);
    expect(vm.chart.series.map((s) => s.label)).toEqual(["nova-3"]);
    expect(vm.chart.total).toBe(600);
    expect(vm.breakdown[0]?.audioSeconds).toBe(600);
  });

  it("honours the 7 day range", () => {
    event("2026-10-01T03:00:00Z"); // outside the last 7 local days
    event("2026-10-14T03:00:00Z");
    const state = { ...DEFAULT_STATE, range: "7d" } as const;
    const data = loadUsagePage(state, NOW, deps());
    expect(data.series.days).toHaveLength(7);
    expect(data.summary.totals.requests).toBe(1);
  });
});
