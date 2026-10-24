import { describe, expect, it } from "vitest";
import type { MinutesRunDto } from "@/lib/api-types";
import { hasUnresolvedFailure, isActiveRun, runProgressView, shouldPoll } from "./run-progress";

const run = (over: Partial<MinutesRunDto> = {}): MinutesRunDto => ({
  runId: "r1",
  lang: "vi",
  status: "running",
  phase: "map",
  done: 0,
  total: 4,
  error: null,
  startedAt: "2026-10-24T08:00:00.000Z",
  finishedAt: null,
  ...over,
});

describe("isActiveRun", () => {
  it("is true only for queued and running", () => {
    expect(isActiveRun(run({ status: "queued" }))).toBe(true);
    expect(isActiveRun(run({ status: "running" }))).toBe(true);
    for (const status of ["done", "failed", "cancelled"] as const) {
      expect(isActiveRun(run({ status }))).toBe(false);
    }
    expect(isActiveRun(null)).toBe(false);
  });
});

describe("runProgressView", () => {
  it("counts chunks, reduce and finalize as steps with Vietnamese labels", () => {
    expect(runProgressView(run({ done: 0, total: 4 }))).toEqual({
      label: "Đọc từng đoạn",
      step: 1,
      steps: 6,
      percent: 0,
    });
    expect(runProgressView(run({ done: 2, total: 4 }))).toMatchObject({ step: 3, percent: 33 });
    expect(runProgressView(run({ phase: "reduce", done: 4, total: 4 }))).toEqual({
      label: "Gộp ý chính",
      step: 5,
      steps: 6,
      percent: 67,
    });
    expect(runProgressView(run({ phase: "finalize", done: 4, total: 4 }))).toEqual({
      label: "Hoàn thiện",
      step: 6,
      steps: 6,
      percent: 83,
    });
  });

  it("handles a single pass (total 1) and an unknown total", () => {
    expect(runProgressView(run({ done: 0, total: 1 }))).toMatchObject({ step: 1, steps: 3 });
    expect(runProgressView(run({ phase: "finalize", done: 1, total: 1 }))).toMatchObject({
      step: 3,
      steps: 3,
    });
    expect(runProgressView(run({ status: "queued", phase: null, total: 0 }))).toEqual({
      label: "Đang chuẩn bị",
      step: 1,
      steps: 3,
      percent: 0,
    });
  });

  it("copes with no run and never exceeds the step count", () => {
    expect(runProgressView(null)).toMatchObject({ label: "Đang chuẩn bị", step: 1, percent: 0 });
    const view = runProgressView(run({ phase: "finalize", done: 99, total: 4 }));
    expect(view.step).toBeLessThanOrEqual(view.steps);
    expect(view.percent).toBeLessThanOrEqual(100);
  });
});

describe("shouldPoll", () => {
  it("polls only while the run is active and the tab is visible", () => {
    expect(shouldPoll(true, true)).toBe(true);
    expect(shouldPoll(true, false)).toBe(false);
    expect(shouldPoll(false, true)).toBe(false);
  });
});

describe("hasUnresolvedFailure", () => {
  const failed = run({ status: "failed", finishedAt: "2026-10-24T08:05:00.000Z" });

  it("is true for a failed run with no minutes or newer than the minutes", () => {
    expect(hasUnresolvedFailure(failed, null)).toBe(true);
    expect(hasUnresolvedFailure(failed, "2026-10-24T08:00:00.000Z")).toBe(true);
  });

  it("is false once newer minutes exist, and for runs that did not fail", () => {
    expect(hasUnresolvedFailure(failed, "2026-10-24T08:10:00.000Z")).toBe(false);
    expect(hasUnresolvedFailure(run({ status: "done" }), null)).toBe(false);
    expect(hasUnresolvedFailure(run({ status: "running" }), null)).toBe(false);
  });
});
