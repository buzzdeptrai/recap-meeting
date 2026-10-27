import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCapture } from "../src/capture";
import { computeMetrics, percentile } from "../src/metrics";
import { replayCapture } from "../src/replay";
import { checkThresholds } from "../src/thresholds";
import { turnLines } from "./builders";
import { fixtureLines, genuineRepeatTurn, overlapTurns, revisedTurn } from "./scenarios";

const fixture = fileURLToPath(new URL("./fixtures/synthetic.jsonl", import.meta.url));
const cli = fileURLToPath(new URL("../src/index.ts", import.meta.url));
const run = (lines = fixtureLines(), config = {}) =>
  computeMetrics(replayCapture(lines, { language: "en", config }));

describe("replay metrics", () => {
  it("a revised hypothesis (three -> 3) is neither a dup nor lost", () => {
    const metrics = run(turnLines(revisedTurn));
    expect(metrics).toMatchObject({ segments: 1, dups: 0, lost: 0, extra: 0 });
  });

  it("a genuine speaker repeat (no no no) is not flagged", () => {
    const metrics = run(turnLines(genuineRepeatTurn));
    expect(metrics).toMatchObject({ dups: 0, lost: 0 });
  });

  it("a vendor overlap the segmenter drops is reported as dropped, not lost or dup", () => {
    const lines = overlapTurns.flatMap((spec) => turnLines(spec));
    const metrics = run(lines);
    expect(metrics).toMatchObject({ dups: 0, lost: 0, droppedOverlap: 4 });
  });

  it("a boundary overlap that leaks into the segments is flagged as dups", () => {
    const lines = overlapTurns.flatMap((spec) => turnLines(spec));
    const metrics = run(lines, { overlapMaxGapMs: -1_000_000 });
    expect(metrics.dups).toBe(4);
  });

  it("flags final words that never reach a segment as lost", () => {
    const result = replayCapture(fixtureLines(), { language: "en" });
    result.segments[0]!.tokens = result.segments[0]!.tokens.slice(0, -2);
    expect(computeMetrics(result).lost).toBe(2);
  });

  it("reports latency and tiny chunks", () => {
    const metrics = run(turnLines({ startMs: 0, words: ["okay", "right"] }));
    expect(metrics.tinyChunkPct).toBe(100);
    expect(metrics.latencyP50Ms).not.toBeNull();
  });

  it("percentile uses nearest rank", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe("capture + thresholds + cli", () => {
  it("rejects a bad capture line with its number", () => {
    expect(() => parseCapture('{"tMs":1,"ch":0,"raw":"{}"}\n{"tMs":"x"}')).toThrow(/line 2/);
  });

  it("lists every exceeded limit", () => {
    const metrics = { ...run(), dups: 3, lost: 2 };
    const failures = checkThresholds(metrics, { maxDups: 0, maxLost: 5 });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("dups");
  });

  it("fixture file matches the scenarios and passes strict limits", () => {
    expect(parseCapture(readFileSync(fixture, "utf8"))).toHaveLength(fixtureLines().length);
    const out = execFileSync(
      "npx",
      ["tsx", cli, "--file", fixture, "--language", "en", "--max-dups", "0", "--max-lost", "0"],
      { encoding: "utf8" },
    );
    expect(out).toContain("dups            0");
  });

  it("exits 1 with a clear message when a limit is exceeded", () => {
    const res = spawnSync(
      "npx",
      ["tsx", cli, "--file", fixture, "--language", "en", "--max-p90-ms", "100"],
      {
        encoding: "utf8",
      },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("FAIL latency p90");
  });
});
