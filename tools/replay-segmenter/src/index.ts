/**
 * USAGE
 *   npm run start -w @recap/tool-replay-segmenter -- --file capture.jsonl [flags]
 *
 * Replays a recorded AssemblyAI capture (JSONL: {"tMs","ch","base","raw"}) through the real
 * Segmenter on a virtual clock (about a second for an hour of audio) and prints:
 *   dups (words emitted twice at a segment boundary), lost (final-turn words never emitted),
 *   word-to-emit latency p50/p90, and the share of tiny chunks (<= 5 words).
 *
 * Flags
 *   --file <path>        capture JSONL (required)
 *   --language <code>    segmenter profile: vi | multi | en ... (default multi, as in the room)
 *   --json               print metrics as JSON
 *   --max-dups <n>       exit 1 if dups exceed n
 *   --max-lost <n>       exit 1 if lost words exceed n
 *   --max-p90-ms <n>     exit 1 if latency p90 exceeds n ms
 *   --max-tiny-pct <n>   exit 1 if tiny chunks exceed n percent
 * Exit codes: 0 ok, 1 threshold exceeded, 2 bad input.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseCapture } from "./capture";
import { computeMetrics } from "./metrics";
import { replayCapture } from "./replay";
import { checkThresholds, formatReport, type Thresholds } from "./thresholds";

const EXIT_THRESHOLD = 1;
const EXIT_BAD_INPUT = 2;

function numberFlag(name: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${name} must be a number, got "${value}"`);
  return parsed;
}

function main(): number {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      language: { type: "string", default: "multi" },
      json: { type: "boolean", default: false },
      "max-dups": { type: "string" },
      "max-lost": { type: "string" },
      "max-p90-ms": { type: "string" },
      "max-tiny-pct": { type: "string" },
    },
  });
  if (!values.file) throw new Error("--file <capture.jsonl> is required (see the usage block)");
  const limits: Thresholds = {
    maxDups: numberFlag("max-dups", values["max-dups"]),
    maxLost: numberFlag("max-lost", values["max-lost"]),
    maxP90Ms: numberFlag("max-p90-ms", values["max-p90-ms"]),
    maxTinyPct: numberFlag("max-tiny-pct", values["max-tiny-pct"]),
  };
  const lines = parseCapture(readFileSync(values.file, "utf8"));
  const metrics = computeMetrics(replayCapture(lines, { language: values.language }));
  console.log(values.json ? JSON.stringify(metrics, null, 2) : formatReport(metrics));
  const failures = checkThresholds(metrics, limits);
  for (const failure of failures) console.error(failure);
  return failures.length ? EXIT_THRESHOLD : 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`replay-segmenter: ${(error as Error).message}`);
  process.exitCode = EXIT_BAD_INPUT;
}
