import { CHANNEL_ME, CHANNEL_OTHERS } from "@recap/core";
import type { SttResult, SttWord } from "../types";

const MS_PER_SECOND = 1_000;

export type ParsedMessage =
  | { kind: "result"; isFinal: boolean; result: SttResult }
  | { kind: "error"; message: string }
  | { kind: "ignored" };

interface RawWord {
  word?: string;
  punctuated_word?: string;
  start?: number;
  end?: number;
  confidence?: number;
  language?: string;
}

interface RawMessage {
  type?: string;
  channel_index?: number[];
  start?: number;
  duration?: number;
  is_final?: boolean;
  channel?: {
    detected_language?: string;
    alternatives?: Array<{ transcript?: string; words?: RawWord[]; languages?: string[] }>;
  };
  err_msg?: string;
  description?: string;
}

const toMs = (seconds: number, baseMs: number) => baseMs + Math.round(seconds * MS_PER_SECOND);

function parseWords(words: RawWord[] | undefined, baseMs: number): SttWord[] {
  const parsed: SttWord[] = [];
  for (const word of words ?? []) {
    const text = word.punctuated_word ?? word.word;
    if (!text || typeof word.start !== "number" || typeof word.end !== "number") continue;
    parsed.push({
      text,
      startMs: toMs(word.start, baseMs),
      endMs: toMs(word.end, baseMs),
      confidence: typeof word.confidence === "number" ? word.confidence : null,
    });
  }
  return parsed;
}

/** Dominant per-word language (nova-3 `multi`), used when no explicit detection is present. */
function dominantLanguage(words: RawWord[] | undefined): string | null {
  const counts = new Map<string, number>();
  for (const word of words ?? []) {
    if (word.language) counts.set(word.language, (counts.get(word.language) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [lang, count] of counts) {
    if (count > bestCount) {
      best = lang;
      bestCount = count;
    }
  }
  return best;
}

function detectLanguage(raw: RawMessage): string | null {
  const alt = raw.channel?.alternatives?.[0];
  return alt?.languages?.[0] ?? raw.channel?.detected_language ?? dominantLanguage(alt?.words);
}

function parseResults(raw: RawMessage, baseMs: number): ParsedMessage {
  const channel = raw.channel_index?.[0];
  if (channel !== CHANNEL_ME && channel !== CHANNEL_OTHERS) return { kind: "ignored" };
  const alt = raw.channel?.alternatives?.[0];
  const text = alt?.transcript?.trim() ?? "";
  if (!text || typeof raw.start !== "number") return { kind: "ignored" };
  const startMs = toMs(raw.start, baseMs);
  const endMs = toMs(raw.start + (raw.duration ?? 0), baseMs);
  return {
    kind: "result",
    isFinal: raw.is_final === true,
    result: {
      channel,
      text,
      startMs,
      endMs,
      words: parseWords(alt?.words, baseMs),
      lang: detectLanguage(raw),
    },
  };
}

/**
 * Parses one Deepgram text frame. `baseMs` is the audio-timeline offset of the current
 * connection (Deepgram timestamps restart at 0 on every new socket).
 */
export function parseDeepgramMessage(data: string, baseMs: number): ParsedMessage {
  let raw: RawMessage;
  try {
    raw = JSON.parse(data) as RawMessage;
  } catch {
    return { kind: "ignored" };
  }
  if (!raw || typeof raw !== "object") return { kind: "ignored" };
  if (raw.type === "Results") return parseResults(raw, baseMs);
  if (raw.type === "Error") {
    return { kind: "error", message: raw.description ?? raw.err_msg ?? "Deepgram error" };
  }
  return { kind: "ignored" };
}
