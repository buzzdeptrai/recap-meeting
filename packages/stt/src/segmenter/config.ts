/**
 * All segmenter thresholds in one place. Rationale: translation quality needs whole phrases, but a
 * live subtitle may not lag; so cuts prefer sentence ends, fall back to pauses that are longer for
 * short chunks, and never land on a function word until a safety cap forces it.
 */
export interface SegmenterConfig {
  /** Cut after this long without a new interim once `longChunkWords` words are pending. */
  silenceMs: number;
  /** Longer pause required for short chunks (`minWords`..`longChunkWords`-1 words). */
  silenceShortMs: number;
  /** Pending words needed before a silence cut. Also the minimum for a final. */
  minWords: number;
  /** Pending words from which the shorter `silenceMs` applies. */
  longChunkWords: number;
  /** Minimum words before a sentence-ending punctuation mark may cut. */
  sentenceMinWords: number;
  /** A sentence-final mark on the last word cuts after this short settle time (interims may revise). */
  sentenceEndMs: number;
  /** Words needed before a semantic boundary may cut. */
  semanticMinWords: number;
  /** Fraction of the pending words (from the end) searched for a boundary. */
  semanticTailRatio: number;
  /** Preferred caps: cut at the first safe point (not on a dependent word) beyond these. */
  hardMaxWords: number;
  hardMaxChars: number;
  /** Speech duration after which the next safe point cuts (keeps live lag near 6 s). */
  maxSpeechMs: number;
  /** Safety caps: beyond these a cut may land on a dependent word. */
  safetyMaxWords: number;
  safetyMaxChars: number;
  safetyMaxSpeechMs: number;
  /** A held final (short or ending on a dependent word) is flushed after this long. */
  finalBufferTimeoutMs: number;
  /**
   * Own silence timer is skipped until the pending text holds `longChunkWords` words AND this much
   * speech, so it never cuts before the STT vendor ends the turn. 0 = no such gate (English).
   */
  silenceMinSpeechMs: number;
}

const SILENCE_MS = 600;
const SILENCE_SHORT_MS = 1_000;
const MIN_WORDS = 5;
const LONG_CHUNK_WORDS = 10;
const SENTENCE_MIN_WORDS = 3;
const SENTENCE_END_MS = 250;
const SEMANTIC_MIN_WORDS = 10;
const SEMANTIC_TAIL_RATIO = 0.4;
const HARD_MAX_WORDS = 18;
const HARD_MAX_CHARS = 200;
const MAX_SPEECH_MS = 6_000;
const SAFETY_MAX_WORDS = 28;
const SAFETY_MAX_CHARS = 280;
const SAFETY_MAX_SPEECH_MS = 8_000;
const FINAL_BUFFER_TIMEOUT_MS = 3_000;
const NO_SILENCE_SPEECH_GATE_MS = 0;

export const DEFAULT_SEGMENTER_CONFIG: SegmenterConfig = {
  silenceMs: SILENCE_MS,
  silenceShortMs: SILENCE_SHORT_MS,
  minWords: MIN_WORDS,
  longChunkWords: LONG_CHUNK_WORDS,
  sentenceMinWords: SENTENCE_MIN_WORDS,
  sentenceEndMs: SENTENCE_END_MS,
  semanticMinWords: SEMANTIC_MIN_WORDS,
  semanticTailRatio: SEMANTIC_TAIL_RATIO,
  hardMaxWords: HARD_MAX_WORDS,
  hardMaxChars: HARD_MAX_CHARS,
  maxSpeechMs: MAX_SPEECH_MS,
  safetyMaxWords: SAFETY_MAX_WORDS,
  safetyMaxChars: SAFETY_MAX_CHARS,
  safetyMaxSpeechMs: SAFETY_MAX_SPEECH_MS,
  finalBufferTimeoutMs: FINAL_BUFFER_TIMEOUT_MS,
  silenceMinSpeechMs: NO_SILENCE_SPEECH_GATE_MS,
};

/**
 * Vietnamese profile. Vietnamese syllables are tokenised as words (measured: 65 segments averaged
 * 7.3 words / 2.2 s, many cut mid-phrase), so the English word thresholds are scaled up roughly
 * 1.6x and times stretched; the owner accepts a few extra seconds for whole sentences.
 */
export const VI_SEGMENTER_CONFIG: SegmenterConfig = {
  ...DEFAULT_SEGMENTER_CONFIG,
  silenceMs: 1_200,
  silenceShortMs: 1_800,
  minWords: 9,
  longChunkWords: 16,
  sentenceMinWords: 4,
  semanticMinWords: 16,
  hardMaxWords: 30,
  hardMaxChars: 260,
  maxSpeechMs: 9_000,
  safetyMaxWords: 42,
  safetyMaxChars: 380,
  safetyMaxSpeechMs: 12_000,
  finalBufferTimeoutMs: 4_000,
  silenceMinSpeechMs: 4_000,
};

/** Languages whose speech may be Vietnamese (`multi`/`detect` can code-switch into it). */
const VIETNAMESE_CAPABLE = new Set<string>(["vi", "multi", "detect", "auto"]);

/** Segmenter profile for a session/STT language; English keeps the original thresholds. */
export function segmenterConfigForLanguage(language: string): SegmenterConfig {
  return VIETNAMESE_CAPABLE.has(language) ? VI_SEGMENTER_CONFIG : DEFAULT_SEGMENTER_CONFIG;
}
