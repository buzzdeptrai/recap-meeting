import type { CaptureLine } from "../src/capture";

const WORD_MS = 300;
const ARRIVAL_LAG_MS = 100;

export interface TurnSpec {
  ch?: 0 | 1;
  /** Words of the final hypothesis; interims grow by one word at a time. */
  words: string[];
  /** Absolute audio start of the first word. */
  startMs: number;
  /** Interim hypotheses to send instead of the growing prefixes (revisions). */
  interims?: string[][];
  /** Final text (defaults to words joined, with a closing period). */
  finalText?: string;
  /** Shifts when frames arrive without changing word timestamps (vendor re-reporting old audio). */
  arrivalShiftMs?: number;
}

function turn(words: string[], startMs: number, end: boolean): string {
  return JSON.stringify({
    type: "Turn",
    transcript: words.join(" "),
    end_of_turn: end,
    turn_is_formatted: end,
    words: words.map((text, i) => ({
      text,
      start: startMs + i * WORD_MS,
      end: startMs + (i + 1) * WORD_MS - 20,
      confidence: 0.9,
    })),
  });
}

/** Interim frames arriving as each word is spoken, then one formatted final frame. */
export function turnLines(spec: TurnSpec): CaptureLine[] {
  const ch = spec.ch ?? 1;
  const shift = spec.arrivalShiftMs ?? 0;
  const hypotheses = spec.interims ?? spec.words.map((_, i) => spec.words.slice(0, i + 1));
  const lines = hypotheses.map((words, i) => ({
    tMs: shift + spec.startMs + (i + 1) * WORD_MS + ARRIVAL_LAG_MS,
    ch,
    base: 0,
    raw: turn(words, spec.startMs, false),
  }));
  const endMs = shift + spec.startMs + spec.words.length * WORD_MS + ARRIVAL_LAG_MS + 200;
  const finalWords = spec.finalText ? spec.finalText.split(" ") : spec.words;
  lines.push({ tMs: endMs, ch, base: 0, raw: turn(finalWords, spec.startMs, true) });
  return lines;
}

export const toJsonl = (lines: CaptureLine[]) =>
  lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
