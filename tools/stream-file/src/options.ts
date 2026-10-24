import { parseArgs } from "node:util";
import type { SourceLang, TargetLang } from "@recap/core";

export const HELP = `stream-file: stream an audio file through the realtime WebSocket like the browser does.

Usage: npm run start -w @recap/tool-stream-file -- --file <audio> [options]

  --file <path>            Audio of the other side (any format ffmpeg decodes). Goes to ch1.
  --mic-file <path>        Optional audio for ch0 (local mic). Without it ch0 is silent.
  --meeting-title <text>   Meeting title (default: "stream-file <file name>").
  --source-lang <l>        auto | vi | en | multi            (default: multi)
  --target-lang <l>        vi | en                           (default: vi)
  --speed <n|max>          1 = real time, 4 = 4x faster, max = as fast as possible (default: 1)
  --url <ws url>           Realtime WebSocket (default: ws://localhost:4001/ws)
  --web-url <http url>     Web app used to create the meeting via REST (default: http://localhost:3000);
                           falls back to writing the SQLite database (DB_PATH) when unreachable.
  --token <token>          Service token for the WebSocket (default: env RECAP_SERVICE_TOKEN; prefer the env,
                           command-line arguments are visible in ps).
  --meeting-id <id>        Resume an existing (ended) meeting instead of creating one (sends resume:true).
  --mark-topic-at <s[:label]>   Send a topic marker <s> seconds into this stream (repeatable).
  --mark-conclusion-at <s>      Send a conclusion marker <s> seconds into this stream (repeatable).
  --mark-clock <audio|wall>     How the marker atMs is computed (default: audio).
                           audio = baseMs + stream offset (exact); wall = Date.now() - (ready received - baseMs),
                           exactly like the browser room, so the alignment report shows the wall-clock error.
  --help                   Show this help.

Ctrl+C sends "stop" so the meeting is finalized, then prints the summary.
Keys are read by the servers from .env; this tool never reads or prints them.`;

export interface Options {
  file: string;
  micFile: string | null;
  title: string;
  sourceLang: SourceLang;
  targetLang: TargetLang;
  /** Pace multiplier; Infinity = no pacing. */
  speed: number;
  url: string;
  /** Service token override; null = use env RECAP_SERVICE_TOKEN. */
  token: string | null;
  webUrl: string;
  /** Existing meeting to resume (skips creation). */
  meetingId: string | null;
  marks: StreamMark[];
  markClock: MarkClock;
}

export type MarkClock = "audio" | "wall";

/** A marker sent while streaming; `atSec` is relative to the start of this stream. */
export interface StreamMark {
  kind: "topic" | "conclusion";
  atSec: number;
  label?: string;
}

export function parseMark(kind: StreamMark["kind"], value: string): StreamMark {
  const [sec = "", ...rest] = value.split(":");
  const atSec = Number(sec);
  if (!Number.isFinite(atSec) || atSec < 0) throw new Error(`Bad marker time: ${value}`);
  const label = rest.join(":").trim();
  return label ? { kind, atSec, label } : { kind, atSec };
}

const SOURCE_LANGS = ["auto", "vi", "en", "multi"] as const;
const TARGET_LANGS = ["vi", "en"] as const;

function oneOf<T extends string>(name: string, value: string, allowed: readonly T[]): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`--${name} must be one of: ${allowed.join(", ")}`);
}

export function parseSpeed(value: string): number {
  if (value === "max") return Infinity;
  const speed = Number(value);
  if (!Number.isFinite(speed) || speed <= 0) throw new Error("--speed must be > 0 or 'max'");
  return speed;
}

/** Returns null when --help was requested. Throws on invalid input. */
export function parseOptions(argv: string[]): Options | null {
  const { values } = parseArgs({
    args: argv,
    options: {
      file: { type: "string" },
      "mic-file": { type: "string" },
      "meeting-title": { type: "string" },
      "source-lang": { type: "string", default: "multi" },
      "target-lang": { type: "string", default: "vi" },
      speed: { type: "string", default: "1" },
      url: { type: "string", default: "ws://localhost:4001/ws" },
      token: { type: "string" },
      "web-url": { type: "string", default: "http://localhost:3000" },
      "meeting-id": { type: "string" },
      "mark-topic-at": { type: "string", multiple: true },
      "mark-conclusion-at": { type: "string", multiple: true },
      "mark-clock": { type: "string", default: "audio" },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) return null;
  if (!values.file) throw new Error("--file is required (see --help)");
  const name = values.file.split("/").pop() ?? values.file;
  return {
    file: values.file,
    micFile: values["mic-file"] ?? null,
    title: values["meeting-title"] ?? `stream-file ${name}`,
    sourceLang: oneOf("source-lang", values["source-lang"], SOURCE_LANGS),
    targetLang: oneOf("target-lang", values["target-lang"], TARGET_LANGS),
    speed: parseSpeed(values.speed),
    url: values.url,
    token: values.token ?? null,
    webUrl: values["web-url"],
    meetingId: values["meeting-id"] ?? null,
    markClock: oneOf("mark-clock", values["mark-clock"], ["audio", "wall"] as const),
    marks: [
      ...(values["mark-topic-at"] ?? []).map((v) => parseMark("topic", v)),
      ...(values["mark-conclusion-at"] ?? []).map((v) => parseMark("conclusion", v)),
    ].sort((a, b) => a.atSec - b.atSec),
  };
}
