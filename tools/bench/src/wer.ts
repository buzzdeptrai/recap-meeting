const APOSTROPHES = /['’‘`]/g;
const NON_WORD = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE = /\s+/g;

/**
 * Normalises text for scoring: NFC (so composed/decomposed Vietnamese diacritics compare equal),
 * lowercase, apostrophes dropped, other punctuation → space, whitespace collapsed.
 * Diacritics are kept: "ma" and "má" are different words.
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(APOSTROPHES, "")
    .replace(NON_WORD, " ")
    .replace(WHITESPACE, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized ? normalized.split(" ") : [];
}

/** Levenshtein distance over any two sequences (two-row DP, O(n*m) time, O(m) memory). */
export function editDistance<T>(a: readonly T[], b: readonly T[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

export interface ErrorRate {
  /** edit distance / reference length; can exceed 1. NaN when the reference is empty. */
  rate: number;
  distance: number;
  referenceLength: number;
}

function rateOf(reference: readonly string[], hypothesis: readonly string[]): ErrorRate {
  const distance = editDistance(reference, hypothesis);
  return {
    rate: reference.length === 0 ? Number.NaN : distance / reference.length,
    distance,
    referenceLength: reference.length,
  };
}

/** Word error rate on normalised text. */
export function wer(reference: string, hypothesis: string): ErrorRate {
  return rateOf(tokenize(reference), tokenize(hypothesis));
}

/** Character error rate on normalised text (single spaces count as characters). */
export function cer(reference: string, hypothesis: string): ErrorRate {
  return rateOf([...normalizeText(reference)], [...normalizeText(hypothesis)]);
}
