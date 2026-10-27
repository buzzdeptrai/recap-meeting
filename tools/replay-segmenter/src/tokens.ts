/** Same normalisation as the segmenter's own tokenizer (NFC, lowercase, no punctuation). */
const APOSTROPHES = /['’‘`]/g;
const NON_WORD = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE = /\s+/g;

export function tokenize(text: string): string[] {
  const normalized = text
    .normalize("NFC")
    .toLowerCase()
    .replace(APOSTROPHES, "")
    .replace(NON_WORD, " ")
    .replace(WHITESPACE, " ")
    .trim();
  return normalized ? normalized.split(" ") : [];
}

export interface TokenTime {
  startMs: number;
  endMs: number;
}

/**
 * Audio time of each token of `tokenize(result.text)`. Uses the word timings when they yield the
 * same token count; otherwise spreads the tokens evenly over the result's span.
 */
export function tokenTimes(result: {
  text: string;
  startMs: number;
  endMs: number;
  words: Array<{ text: string; startMs: number; endMs: number }>;
}): TokenTime[] {
  const count = tokenize(result.text).length;
  const fromWords = result.words.flatMap((word) =>
    tokenize(word.text).map(() => ({ startMs: word.startMs, endMs: word.endMs })),
  );
  if (fromWords.length === count) return fromWords;
  const step = (result.endMs - result.startMs) / Math.max(1, count);
  return Array.from({ length: count }, (_, i) => ({
    startMs: Math.round(result.startMs + i * step),
    endMs: Math.round(result.startMs + (i + 1) * step),
  }));
}
