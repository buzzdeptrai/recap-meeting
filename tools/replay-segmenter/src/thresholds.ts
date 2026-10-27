import type { Metrics } from "./metrics";

export interface Thresholds {
  maxDups?: number;
  maxLost?: number;
  maxP90Ms?: number;
  maxTinyPct?: number;
}

/** Returns one human-readable line per exceeded threshold (empty = pass). */
export function checkThresholds(metrics: Metrics, limits: Thresholds): string[] {
  const failures: string[] = [];
  const over = (name: string, actual: number | null, max: number | undefined, unit = "") => {
    if (max === undefined || actual === null || actual <= max) return;
    failures.push(`FAIL ${name} = ${round(actual)}${unit} exceeds limit ${max}${unit}`);
  };
  over("dups", metrics.dups, limits.maxDups);
  over("lost", metrics.lost, limits.maxLost);
  over("latency p90", metrics.latencyP90Ms, limits.maxP90Ms, " ms");
  over("tiny chunks", metrics.tinyChunkPct, limits.maxTinyPct, " %");
  return failures;
}

export function formatReport(metrics: Metrics): string {
  const ms = (v: number | null) => (v === null ? "n/a" : `${Math.round(v)} ms`);
  return [
    `segments        ${metrics.segments}`,
    `dups            ${metrics.dups}`,
    `lost            ${metrics.lost}`,
    `dropped overlap ${metrics.droppedOverlap}  (vendor repeats skipped on purpose)`,
    `extra           ${metrics.extra}  (emitted words not in final text, not repeats)`,
    `latency p50     ${ms(metrics.latencyP50Ms)}  (n=${metrics.latencySamples})`,
    `latency p90     ${ms(metrics.latencyP90Ms)}`,
    `tiny chunks     ${round(metrics.tinyChunkPct)} %  (${metrics.tinyChunks} of ${metrics.segments}, <= 5 words)`,
  ].join("\n");
}

const round = (value: number) => Math.round(value * 10) / 10;
