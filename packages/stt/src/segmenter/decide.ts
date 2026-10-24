import type { SegmenterConfig } from "./config";
import type { CutReason } from "./cut-reason";
import { isDependentWord } from "./dependent-words";
import { exceedsHardCap, shouldSemanticCut } from "./rules";

export type CutDecision =
  /** Cut the first `end` pending words now. */
  | { kind: "cut"; end: number; reason: CutReason }
  /** Cut all pending words if no new interim arrives within `delayMs`. */
  | { kind: "wait"; delayMs: number; reason: CutReason }
  | { kind: "none" };

const SENTENCE_END = /[.!?…。！？]["'”’)\]]*$/;
const ABBREVIATIONS = new Set([
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "prof.",
  "vs.",
  "etc.",
  "e.g.",
  "i.e.",
]);
const NO_DECISION: CutDecision = { kind: "none" };

export function endsSentence(token: string | undefined): boolean {
  if (!token || !SENTENCE_END.test(token)) return false;
  return !ABBREVIATIONS.has(token.toLowerCase());
}

/**
 * Token count of the longest prefix of `words` that ends on a sentence-final mark and is followed
 * by more words (the trailing mark is handled by a settle timer). 0 when there is none.
 */
export function sentencePrefixLength(words: readonly string[], minWords: number): number {
  for (let i = words.length - 2; i >= minWords - 1; i--) {
    if (endsSentence(words[i])) return i + 1;
  }
  return 0;
}

export function endsOnDependentWord(words: readonly string[]): boolean {
  return isDependentWord(words[words.length - 1]);
}

/** True once a cut may land on a dependent word. */
export function exceedsSafetyCap(
  words: readonly string[],
  speechMs: number,
  config: SegmenterConfig,
  carryWords = 0,
): boolean {
  return (
    words.length + carryWords >= config.safetyMaxWords ||
    words.join(" ").length >= config.safetyMaxChars ||
    speechMs >= config.safetyMaxSpeechMs
  );
}

function silenceDelay(count: number, config: SegmenterConfig): number {
  return count < config.longChunkWords ? config.silenceShortMs : config.silenceMs;
}

/** True when our own silence timer may run (always, unless the profile gates it on speech time). */
function silenceGateOpen(count: number, speechMs: number, config: SegmenterConfig): boolean {
  if (config.silenceMinSpeechMs <= 0) return true;
  return count >= config.longChunkWords && speechMs >= config.silenceMinSpeechMs;
}

/**
 * Decides what to do with the pending (uncut) interim words. Pure; `speechMs` is audio time.
 * `carryWords` counts held text that will be merged into the cut (it counts toward the caps).
 */
export function decideCut(
  words: readonly string[],
  speechMs: number,
  config: SegmenterConfig,
  carryWords = 0,
): CutDecision {
  const prefix = sentencePrefixLength(words, config.sentenceMinWords);
  if (prefix > 0) return { kind: "cut", end: prefix, reason: "sentence" };
  const last = words[words.length - 1];
  if (endsSentence(last) && words.length >= config.sentenceMinWords) {
    return { kind: "wait", delayMs: config.sentenceEndMs, reason: "sentence" };
  }
  if (endsOnDependentWord(words) && !exceedsSafetyCap(words, speechMs, config, carryWords))
    return NO_DECISION;
  if (exceedsHardCap(words, config, carryWords) || speechMs >= config.maxSpeechMs) {
    return { kind: "cut", end: words.length, reason: "hard_cap" };
  }
  if (shouldSemanticCut(words, config)) {
    return { kind: "cut", end: words.length, reason: "semantic" };
  }
  if (words.length < config.minWords) return NO_DECISION;
  if (!silenceGateOpen(words.length, speechMs, config)) return NO_DECISION;
  return { kind: "wait", delayMs: silenceDelay(words.length, config), reason: "silence" };
}
