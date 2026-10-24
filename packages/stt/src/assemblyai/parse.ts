import type { Channel } from "@recap/core";
import type { SttResult, SttWord } from "../types";

export type ParsedMessage =
  | { kind: "result"; isFinal: boolean; result: SttResult }
  | { kind: "speech_started"; timestampMs: number }
  | { kind: "termination" }
  | { kind: "error"; message: string; retryable: boolean }
  | { kind: "ignored" };

interface RawWord {
  text?: string;
  start?: number;
  end?: number;
  confidence?: number;
}

interface RawMessage {
  type?: string;
  transcript?: string;
  end_of_turn?: boolean;
  turn_is_formatted?: boolean;
  words?: RawWord[];
  language_code?: string;
  timestamp?: number;
  error_code?: number;
  error?: string;
}

/** Close code 1008 with this text is the per-minute session-start limit: retrying later works. */
const RATE_LIMIT_TEXT = "too many concurrent sessions";
const UNAUTHORIZED_CODE = 1008;

function parseWords(words: RawWord[] | undefined, baseMs: number): SttWord[] {
  const parsed: SttWord[] = [];
  for (const word of words ?? []) {
    if (!word.text || typeof word.start !== "number" || typeof word.end !== "number") continue;
    parsed.push({
      text: word.text,
      startMs: baseMs + Math.round(word.start),
      endMs: baseMs + Math.round(word.end),
      confidence: typeof word.confidence === "number" ? word.confidence : null,
    });
  }
  return parsed;
}

/**
 * A `Turn` is the latest full transcript of the current turn (each message supersedes the
 * previous one). Final = `end_of_turn` and formatted; partials and unformatted finals are interim.
 * AssemblyAI times are ms from the start of the socket's audio, so `baseMs` maps them onto the
 * session timeline. `fallbackStartMs` covers turns that arrive without word timings.
 */
function parseTurn(
  raw: RawMessage,
  channel: Channel,
  baseMs: number,
  fallbackStartMs: number,
): ParsedMessage {
  const text = raw.transcript?.trim() ?? "";
  if (!text) return { kind: "ignored" };
  const words = parseWords(raw.words, baseMs);
  const startMs = words[0]?.startMs ?? baseMs + fallbackStartMs;
  const endMs = words.at(-1)?.endMs ?? startMs;
  return {
    kind: "result",
    isFinal: raw.end_of_turn === true && raw.turn_is_formatted !== false,
    result: { channel, text, startMs, endMs, words, lang: raw.language_code ?? null },
  };
}

function parseError(raw: RawMessage): ParsedMessage {
  const text = raw.error ?? "AssemblyAI error";
  const rateLimited = text.toLowerCase().includes(RATE_LIMIT_TEXT);
  const unauthorized = raw.error_code === UNAUTHORIZED_CODE && !rateLimited;
  return {
    kind: "error",
    message: `AssemblyAI error ${raw.error_code ?? ""}: ${text}`.trim(),
    retryable: !unauthorized,
  };
}

/** Parses one AssemblyAI v3 text frame for the socket that carries `channel`. */
export function parseAssemblyAiMessage(
  data: string,
  channel: Channel,
  baseMs: number,
  fallbackStartMs = 0,
): ParsedMessage {
  let raw: RawMessage;
  try {
    raw = JSON.parse(data) as RawMessage;
  } catch {
    return { kind: "ignored" };
  }
  if (!raw || typeof raw !== "object") return { kind: "ignored" };
  switch (raw.type) {
    case "Turn":
      return parseTurn(raw, channel, baseMs, fallbackStartMs);
    case "SpeechStarted":
      if (typeof raw.timestamp !== "number") return { kind: "ignored" };
      return { kind: "speech_started", timestampMs: raw.timestamp };
    case "Termination":
      return { kind: "termination" };
    case "Error":
      return parseError(raw);
    default:
      return { kind: "ignored" };
  }
}
