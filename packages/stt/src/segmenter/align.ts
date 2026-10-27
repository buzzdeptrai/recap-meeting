import {
  ALIGN_MIN_ANCHOR_CHARS,
  ALIGN_TAIL_CHARS,
  OVERLAP_MAX_WORDS,
  OVERLAP_MIN_SINGLE_WORD_CHARS,
} from "./config";

const NON_WORD_CHARS = /[^\p{L}\p{N}]/gu;

/** Comparison key of a token: letters/digits only, lowercase (so "CloudBees," == "cloudbees"). */
export function wordKey(token: string): string {
  return token.normalize("NFC").replace(NON_WORD_CHARS, "").toLowerCase();
}

/** Concatenated key of several tokens (token boundaries do not matter: "cloud bees" == "CloudBees"). */
export function joinedKey(tokens: readonly string[]): string {
  return tokens.map(wordKey).join("");
}

/**
 * Where the already-emitted words of an utterance end inside a (possibly revised) token list.
 * STT hypotheses re-write earlier words ("three" -> "3", "A D O" -> "ADO"), so a stored token count
 * is not a stable cut position. Compares letters only, in two steps: an exact prefix match, then a
 * match of the last few emitted characters (nearest to `hint`). null = the text no longer contains
 * what was emitted (a different turn, or a hypothesis rewritten beyond recognition).
 */
export function alignEmittedPrefix(
  tokens: readonly string[],
  emittedKey: string,
  hint: number,
): number | null {
  if (!emittedKey) return 0;
  const tail = emittedKey.slice(-ALIGN_TAIL_CHARS);
  const canAnchor = tail.length >= ALIGN_MIN_ANCHOR_CHARS;
  let prefix = "";
  let best: number | null = null;
  for (let p = 1; p <= tokens.length; p++) {
    prefix += wordKey(tokens[p - 1] ?? "");
    if (prefix === emittedKey) return p;
    if (!canAnchor || !prefix.endsWith(tail)) continue;
    if (best === null || Math.abs(p - hint) < Math.abs(best - hint)) best = p;
  }
  return best;
}

/**
 * Number of leading words of `tokens` that merely repeat the end of the previous segment. Vendors
 * overlap consecutive turns by a word or phrase ("...a while back." | "back. I think ..."), so the
 * repeat is only trusted when the new words start within `maxGapMs` of where the previous segment
 * ended. Genuine repetitions come later than that.
 */
export function overlapPrefixLength(
  previous: readonly string[],
  tokens: readonly string[],
  gapMs: number,
  maxGapMs: number,
): number {
  if (gapMs > maxGapMs) return 0;
  const limit = Math.min(OVERLAP_MAX_WORDS, previous.length, tokens.length);
  for (let k = limit; k >= 1; k--) {
    const head = joinedKey(tokens.slice(0, k));
    if (head !== joinedKey(previous.slice(-k))) continue;
    if (k === 1 && head.length < OVERLAP_MIN_SINGLE_WORD_CHARS) continue;
    return k;
  }
  return 0;
}
