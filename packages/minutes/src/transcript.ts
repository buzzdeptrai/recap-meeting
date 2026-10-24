import { CHANNEL_ME, type MinutesLang } from "@recap/core";
import type { StoredSegment, Translation } from "@recap/db";

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
/** Rough estimate; Vietnamese tokenises worse than English, so stay on the safe side. */
const CHARS_PER_TOKEN = 3;
const SPEAKER_ME = "Tôi";
const SPEAKER_OTHERS = "Người khác";
const UNKNOWN_LANG = "auto";
const TIMESTAMP = /^\s*\[?(\d+):([0-5]\d)(?::([0-5]\d))?\]?\s*$/;

export interface TranscriptLine {
  startMs: number;
  endMs: number;
  /** Formatted `[mm:ss] Tôi|Người khác (lang): text`. */
  text: string;
  /** Topic-marker boundary line (`=== CHỦ ĐỀ ... ===`), not spoken text. */
  boundary?: true;
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / MS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Parses "mm:ss" (minutes may exceed 59) or "h:mm:ss", with optional brackets. */
export function parseTimestamp(value: string | null | undefined): number | null {
  const match = value ? TIMESTAMP.exec(value) : null;
  if (!match) return null;
  const [, first, second, third] = match;
  const parts =
    third === undefined
      ? [0, Number(first), Number(second)]
      : [Number(first), Number(second), Number(third)];
  const [h = 0, m = 0, s = 0] = parts;
  return ((h * SECONDS_PER_MINUTE + m) * SECONDS_PER_MINUTE + s) * MS_PER_SECOND;
}

const baseLang = (lang: string | null) => lang?.toLowerCase().split("-")[0] ?? null;

/** Text in the requested language: original if already that language, else translation, else original. */
function pickText(
  segment: StoredSegment,
  translations: Map<string, string>,
  lang: MinutesLang,
): { text: string; lang: string } {
  const own = baseLang(segment.lang);
  if (own === lang) return { text: segment.text, lang };
  const translated = translations.get(segment.id);
  if (translated) return { text: translated, lang };
  return { text: segment.text, lang: segment.lang ?? UNKNOWN_LANG };
}

export function buildTranscriptLines(
  segments: StoredSegment[],
  translations: Translation[],
  lang: MinutesLang,
): TranscriptLine[] {
  const byId = new Map(
    translations.filter((t) => t.lang === lang).map((t) => [t.segmentId, t.text]),
  );
  return [...segments]
    .sort((a, b) => a.seq - b.seq)
    .filter((s) => s.text.trim() !== "")
    .map((segment) => {
      const picked = pickText(segment, byId, lang);
      const speaker = segment.channel === CHANNEL_ME ? SPEAKER_ME : SPEAKER_OTHERS;
      const text = `[${formatTimestamp(segment.startMs)}] ${speaker} (${picked.lang}): ${picked.text.trim()}`;
      return { startMs: segment.startMs, endMs: segment.endMs, text };
    });
}

export interface WindowSpec {
  beforeMs: number;
  afterMs: number;
}

/**
 * Transcript lines the model should read for a conclusion mark at `atMs`:
 * - nominally [atMs - before, atMs + after]; a line that straddles an edge is kept whole;
 * - "after" stops at the next marker: the next conclusion mark (`otherMarks`) or the next topic
 *   boundary line, whichever comes first (lines starting there belong to the next span);
 * - "before" stops at the previous topic boundary (<= atMs): earlier lines belong to another
 *   topic. A previous conclusion mark is NOT a stop - windows of two marks may overlap.
 * The boundary line that opened the mark's topic is kept when it falls inside the window.
 */
export function markWindow(
  lines: TranscriptLine[],
  atMs: number,
  spec: WindowSpec,
  otherMarks: number[] = [],
): TranscriptLine[] {
  const boundaries = lines.filter((l) => l.boundary === true).map((l) => l.startMs);
  const topicStart = Math.max(Number.NEGATIVE_INFINITY, ...boundaries.filter((t) => t <= atMs));
  const nextStop = Math.min(
    Number.POSITIVE_INFINITY,
    ...boundaries.filter((t) => t > atMs),
    ...otherMarks.filter((m) => m > atMs),
  );
  const from = Math.max(atMs - spec.beforeMs, topicStart);
  const to = atMs + spec.afterMs;
  return lines.filter(
    (line) =>
      line.endMs >= from &&
      line.startMs >= topicStart &&
      line.startMs <= to &&
      line.startMs < nextStop,
  );
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function totalTokens(lines: TranscriptLine[]): number {
  return lines.reduce((sum, line) => sum + estimateTokens(line.text) + 1, 0);
}

/** A topic boundary starts a new chunk once the current one is at least this full. */
const BOUNDARY_CUT_RATIO = 0.6;

/**
 * Splits lines into consecutive chunks of at most ~maxTokens (a single long line stays whole).
 * Topic boundaries are cut points: a chunk never ends with a boundary line, and a boundary may
 * start a new chunk early so topics stay together.
 */
export function splitIntoChunks(lines: TranscriptLine[], maxTokens: number): TranscriptLine[][] {
  const chunks: TranscriptLine[][] = [];
  let current: TranscriptLine[] = [];
  let size = 0;
  const cost = (line: TranscriptLine) => estimateTokens(line.text) + 1;
  for (const line of lines) {
    const overflow = current.length > 0 && size + cost(line) > maxTokens;
    const boundaryCut =
      line.boundary === true && current.length > 0 && size >= maxTokens * BOUNDARY_CUT_RATIO;
    if (overflow || boundaryCut) {
      const dangling: TranscriptLine[] = [];
      while (current.at(-1)?.boundary) dangling.unshift(current.pop() as TranscriptLine);
      if (current.length > 0) chunks.push(current);
      current = dangling;
      size = dangling.reduce((sum, l) => sum + cost(l), 0);
    }
    current.push(line);
    size += cost(line);
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
