import type { SttRun } from "./runner";

export interface ScoredRun extends SttRun {
  wer: number | null;
  cer: number | null;
}

const fmtPct = (value: number | null) =>
  value === null || Number.isNaN(value) ? "n/a" : `${(value * 100).toFixed(1)}%`;
const fmtMs = (value: number | null) => (value === null ? "n/a" : `${Math.round(value)}`);

/** Plain-text table (no deps) for stdout. */
export function renderTable(runs: readonly ScoredRun[], audioSeconds: number): string {
  const header = [
    "language",
    "WER",
    "CER",
    "1st final ms",
    "avg lag ms",
    "finals",
    "langs",
    "status",
  ];
  const rows = runs.map((run) => [
    run.language,
    fmtPct(run.wer),
    fmtPct(run.cer),
    fmtMs(run.firstFinalMs),
    fmtMs(run.avgFinalLagMs),
    String(run.finals),
    run.detectedLanguages.join("/") || "-",
    run.ok ? "ok" : `error: ${run.error ?? "unknown"}`,
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join("  ");
  return [`audio: ${audioSeconds.toFixed(1)} s`, line(header), ...rows.map(line)].join("\n");
}
