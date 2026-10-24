import type { Mark } from "@recap/core";
import { describe, expect, it } from "vitest";
import {
  DEDUPE_WINDOW_MS,
  extractSuggestions,
  hiddenCounts,
  visibleSuggestions,
  type MinutesSuggestions,
} from "./minutes-suggestions";

const mark = (id: string, kind: Mark["kind"], atMs: number): Mark => ({
  id,
  kind,
  atMs,
  label: null,
});

const topic = (
  id: string,
  keyPointTimes: (number | null)[],
  conclusion: { text: string; atMs: number | null; marked: boolean } | null = null,
) => ({
  id,
  title: `Chủ đề ${id}`,
  keyPoints: keyPointTimes.map((atMs, i) => ({ text: `ý ${i}`, atMs })),
  status: "open",
  conclusion,
});

const content = (topics: unknown[]) => ({
  summary: "tóm tắt",
  topics,
  actionItems: [],
  openIssues: [],
});

describe("extractSuggestions", () => {
  it("starts a topic at its earliest key point time", () => {
    const result = extractSuggestions(content([topic("a", [90_000, 30_000, null])]));
    expect(result.topics).toEqual([{ id: "a", title: "Chủ đề a", atMs: 30_000 }]);
  });

  it("drops topics without any timed key point", () => {
    const result = extractSuggestions(content([topic("a", []), topic("b", [null])]));
    expect(result.topics).toEqual([]);
  });

  it("keeps AI-proposed conclusions at their own time", () => {
    const c = { text: "Chốt A", atMs: 50_000, marked: false };
    const result = extractSuggestions(content([topic("a", [10_000], c)]));
    expect(result.conclusions).toEqual([{ id: "a", text: "Chốt A", atMs: 50_000 }]);
  });

  it("falls back to the topic start when the conclusion has no time", () => {
    const c = { text: "Chốt A", atMs: null, marked: false };
    const result = extractSuggestions(content([topic("a", [10_000], c)]));
    expect(result.conclusions[0]?.atMs).toBe(10_000);
  });

  it("skips conclusions with no time at all", () => {
    const c = { text: "Chốt A", atMs: null, marked: false };
    expect(extractSuggestions(content([topic("a", [], c)])).conclusions).toEqual([]);
  });

  it("skips conclusions already backed by a hand mark (marked: true)", () => {
    const c = { text: "Chốt A", atMs: 50_000, marked: true };
    expect(extractSuggestions(content([topic("a", [10_000], c)])).conclusions).toEqual([]);
  });

  it("returns nothing for broken or foreign JSON", () => {
    const empty = { topics: [], conclusions: [] };
    expect(extractSuggestions(null)).toEqual(empty);
    expect(extractSuggestions("{oops")).toEqual(empty);
    expect(extractSuggestions({ topics: "x" })).toEqual(empty);
  });
});

describe("visibleSuggestions", () => {
  const all: MinutesSuggestions = {
    topics: [
      { id: "t1", title: "A", atMs: 100_000 },
      { id: "t2", title: "B", atMs: 400_000 },
    ],
    conclusions: [
      { id: "c1", text: "X", atMs: 200_000 },
      { id: "c2", text: "Y", atMs: 500_000 },
    ],
  };

  it("keeps everything when there are no marks", () => {
    expect(visibleSuggestions(all, [])).toEqual(all);
  });

  it("hides a topic within the window of a topic mark, both directions", () => {
    const before = visibleSuggestions(all, [mark("m", "topic", 100_000 - DEDUPE_WINDOW_MS)]);
    const after = visibleSuggestions(all, [mark("m", "topic", 100_000 + DEDUPE_WINDOW_MS)]);
    expect(before.topics.map((t) => t.id)).toEqual(["t2"]);
    expect(after.topics.map((t) => t.id)).toEqual(["t2"]);
  });

  it("keeps a topic just outside the window", () => {
    const out = visibleSuggestions(all, [mark("m", "topic", 100_000 + DEDUPE_WINDOW_MS + 1)]);
    expect(out.topics).toHaveLength(2);
  });

  it("compares only marks of the same kind", () => {
    const out = visibleSuggestions(all, [mark("m", "conclusion", 100_000)]);
    expect(out.topics).toHaveLength(2);
    const out2 = visibleSuggestions(all, [mark("m", "topic", 200_000)]);
    expect(out2.conclusions).toHaveLength(2);
  });

  it("hides a conclusion near a conclusion mark", () => {
    const out = visibleSuggestions(all, [mark("m", "conclusion", 210_000)]);
    expect(out.conclusions.map((c) => c.id)).toEqual(["c2"]);
  });
});

describe("hiddenCounts", () => {
  it("counts candidates hidden by a nearby hand mark", () => {
    const all = extractSuggestions(content([topic("a", [100_000]), topic("b", [300_000])]));
    const shown = visibleSuggestions(all, [mark("m1", "topic", 100_000 + DEDUPE_WINDOW_MS - 1)]);
    expect(hiddenCounts(all, shown)).toEqual({ topics: 1, conclusions: 0 });
  });
});
