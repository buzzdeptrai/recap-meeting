import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { REPO_ROOT, loadRootEnv } from "@recap/core/node";
import type { SttLanguage } from "@recap/stt";
import {
  audioDurationMs,
  decodeToMono16k,
  toStereoFrames,
  userPath,
} from "../../stream-file/src/audio";
import { checkModels, renderModelChecks } from "./check-models";
import { renderTable, type ScoredRun } from "./report";
import { runDeepgram } from "./runner";
import { cer, wer } from "./wer";

const HELP = `bench: Deepgram STT benchmark (WER/CER, latency) and model sanity check.

Usage:
  npm run start -w @recap/tool-bench -- --file <audio> [--ref <reference.txt>] [options]
  npm run start -w @recap/tool-bench -- check-models

Options:
  --file <path>     Audio file (ffmpeg decodes it; mono goes to ch1 like a meeting's other side).
  --ref <path>      Reference transcript (.txt). Without it only transcripts + latency are shown.
  --configs <list>  Comma list of vi,en,multi,detect (default: vi,en,multi). Runs in parallel.
                    detect = Deepgram detect_language; the streaming API rejects it (HTTP 400), kept for re-checking.
  --speed <n|max>   1 = real time (latency numbers are meaningful), max = fast (lag not measured; Deepgram
                    drops audio when flooded, so transcripts are incomplete). Default 1.
  --out <dir>       JSON output directory (default: data/bench).
  --help            Show this help.

check-models: lists Gemini/OpenAI model ids for the keys in .env, reports whether GEMINI_MODEL and
OPENAI_TRANSLATE_MODEL exist, and runs one tiny EN->VI translation per configured provider.
Keys are never printed.`;

const ALL_CONFIGS: readonly SttLanguage[] = ["vi", "en", "multi", "detect"];
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

function writeJson(dir: string, name: string, data: unknown): string {
  const outDir = resolve(REPO_ROOT, dir);
  mkdirSync(outDir, { recursive: true });
  const path = resolve(outDir, name);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  return path;
}

function parseConfigs(value: string): SttLanguage[] {
  const configs = value.split(",").map((c) => c.trim()) as SttLanguage[];
  const bad = configs.find((c) => !ALL_CONFIGS.includes(c));
  if (bad) throw new Error(`Unknown config "${bad}" (use ${ALL_CONFIGS.join(", ")})`);
  return configs;
}

const DEFAULT_DEEPGRAM_MODEL = "nova-3";

function deepgramEnv(): { apiKey: string; model: string } {
  loadRootEnv();
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY is required in .env (see .env.example)");
  return { apiKey, model: process.env.DEEPGRAM_MODEL?.trim() || DEFAULT_DEEPGRAM_MODEL };
}

async function runCheckModels(out: string): Promise<void> {
  loadRootEnv();
  const checks = await checkModels(process.env);
  console.log(renderModelChecks(checks));
  const slim = checks.map((c) => ({ ...c, modelIds: c.modelIds }));
  console.log(`saved: ${writeJson(out, `models-${stamp()}.json`, slim)}`);
}

async function runBench(values: {
  file?: string;
  ref?: string;
  configs: string;
  speed: string;
  out: string;
}) {
  if (!values.file) throw new Error("--file is required (see --help)");
  const env = deepgramEnv();
  const speed = values.speed === "max" ? Infinity : Number(values.speed);
  if (!(speed > 0)) throw new Error("--speed must be > 0 or 'max'");
  const samples = await decodeToMono16k(values.file);
  const frames = toStereoFrames(null, samples);
  const reference = values.ref ? readFileSync(userPath(values.ref), "utf8") : null;
  const configs = parseConfigs(values.configs);
  console.log(`running ${configs.join(", ")} in parallel (speed ${speed})...`);
  const runs = await Promise.all(
    configs.map((language) =>
      runDeepgram({ language, apiKey: env.apiKey, model: env.model }, frames, speed),
    ),
  );
  const scored: ScoredRun[] = runs.map((run) => ({
    ...run,
    wer: reference ? wer(reference, run.transcript).rate : null,
    cer: reference ? cer(reference, run.transcript).rate : null,
  }));
  const audioSeconds = audioDurationMs(samples.length) / 1000;
  console.log(renderTable(scored, audioSeconds));
  for (const run of scored)
    console.log(`\n[${run.language}] ${run.transcript || "(no transcript)"}`);
  const path = writeJson(values.out, `${stamp()}.json`, {
    file: values.file,
    ref: values.ref ?? null,
    model: env.model,
    speed: Number.isFinite(speed) ? speed : "max",
    audioSeconds,
    runs: scored,
  });
  console.log(`\nsaved: ${path}`);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      file: { type: "string" },
      ref: { type: "string" },
      configs: { type: "string", default: "vi,en,multi" },
      speed: { type: "string", default: "1" },
      out: { type: "string", default: "data/bench" },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) return void console.log(HELP);
  if (positionals[0] === "check-models") return runCheckModels(values.out);
  await runBench(values);
}

main().catch((error: unknown) => {
  console.error(`bench: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
