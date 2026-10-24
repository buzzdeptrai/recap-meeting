import { describe, expect, it } from "vitest";
import { marksFingerprint, minutesStaleReasons, type StaleInput } from "../src";

const base: StaleInput = {
  generatedAt: "2026-10-22T08:00:10.000Z",
  latestSegmentAt: "2026-10-22T08:00:05.000Z",
  latestMarkChangeAt: "2026-10-22T08:00:06.000Z",
  stored: { promptVersion: "2", model: "gpt-4.1", marksFingerprint: "fp1" },
  current: { promptVersion: "2", model: "gpt-4.1", marksFingerprint: "fp1" },
};

const mark = (over: Partial<Parameters<typeof marksFingerprint>[0][number]> = {}) => ({
  id: "k1",
  kind: "conclusion" as const,
  atMs: 1_000,
  label: null,
  ...over,
});

describe("minutesStaleReasons", () => {
  it("is empty when nothing changed", () => {
    expect(minutesStaleReasons(base)).toEqual([]);
  });

  it("flags transcript and mark changes after generation by timestamp", () => {
    expect(minutesStaleReasons({ ...base, latestSegmentAt: "2026-10-22T08:01:00.000Z" })).toEqual([
      "transcript_changed",
    ]);
    expect(
      minutesStaleReasons({ ...base, latestMarkChangeAt: "2026-10-22T08:01:00.000Z" }),
    ).toEqual(["marks_changed"]);
  });

  it("flags a fingerprint difference without a newer mark as marks_removed", () => {
    const current = { ...base.current, marksFingerprint: "fp2" };
    expect(minutesStaleReasons({ ...base, current })).toEqual(["marks_removed"]);
  });

  it("does not add marks_removed when marks_changed already explains the difference", () => {
    const current = { ...base.current, marksFingerprint: "fp2" };
    const reasons = minutesStaleReasons({
      ...base,
      current,
      latestMarkChangeAt: "2026-10-22T08:01:00.000Z",
    });
    expect(reasons).toEqual(["marks_changed"]);
  });

  it("flags prompt and model changes", () => {
    const current = { ...base.current, promptVersion: "3", model: "gpt-5" };
    expect(minutesStaleReasons({ ...base, current })).toEqual(["prompt_updated", "model_changed"]);
  });

  it("treats NULL stored fields (old rows) and unknown current values as 'do not flag'", () => {
    const stored = { promptVersion: null, model: null, marksFingerprint: null };
    const current = { promptVersion: "9", model: "other", marksFingerprint: "zzz" };
    expect(minutesStaleReasons({ ...base, stored, current })).toEqual([]);
    const unknown = { promptVersion: null, model: null, marksFingerprint: null };
    expect(minutesStaleReasons({ ...base, current: unknown })).toEqual([]);
  });

  it("reports several reasons in a stable order", () => {
    const reasons = minutesStaleReasons({
      ...base,
      latestSegmentAt: "2026-10-22T09:00:00.000Z",
      current: { ...base.current, promptVersion: "3" },
    });
    expect(reasons).toEqual(["transcript_changed", "prompt_updated"]);
  });
});

describe("marksFingerprint", () => {
  it("is stable and independent of input order", () => {
    const a = mark();
    const b = mark({ id: "k2", atMs: 5_000, label: "x" });
    expect(marksFingerprint([a, b])).toBe(marksFingerprint([b, a]));
    expect(marksFingerprint([a, b])).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when a mark is removed, moved, relabelled or retyped", () => {
    const a = mark();
    const b = mark({ id: "k2" });
    const full = marksFingerprint([a, b]);
    expect(marksFingerprint([a])).not.toBe(full);
    expect(marksFingerprint([a, mark({ id: "k2", atMs: 2_000 })])).not.toBe(full);
    expect(marksFingerprint([a, mark({ id: "k2", label: "L" })])).not.toBe(full);
    expect(marksFingerprint([a, mark({ id: "k2", kind: "topic" })])).not.toBe(full);
  });

  it("treats a missing label and an empty list consistently", () => {
    expect(marksFingerprint([])).toBe(marksFingerprint([]));
    expect(marksFingerprint([mark({ label: null })])).toBe(
      marksFingerprint([mark({ label: null })]),
    );
  });
});
