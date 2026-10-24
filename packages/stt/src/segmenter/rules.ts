import type { SegmenterConfig } from "./config";

const SINGLE_CONJUNCTIONS = new Set([
  // Vietnamese
  "nhưng",
  "mà",
  "khi",
  "nếu",
  "vì",
  "do",
  "bởi",
  "tuy",
  "dù",
  "thì",
  // English
  "but",
  "however",
  "because",
  "so",
  "when",
  "if",
  "since",
  "though",
  "although",
  "therefore",
  "moreover",
  "furthermore",
  "nevertheless",
  "thus",
  "whereas",
  "while",
  "unless",
  "until",
  "once",
  "yet",
]);

/** Two-word Vietnamese connectives; matched on a pair of adjacent tokens. */
const PHRASE_CONJUNCTIONS = new Set([
  "tuy nhiên",
  "vì vậy",
  "do đó",
  "mặc dù",
  "vả lại",
  "hơn nữa",
  "ngoài ra",
  "cho nên",
  "vì thế",
]);

const CLAUSE_PUNCTUATION = /[,;:，；：、،]$/;
const SENTENCE_PUNCTUATION = /[.!?。！？]$/;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;
const WHITESPACE = /\s+/;

export function tokenize(text: string): string[] {
  return text.trim().split(WHITESPACE).filter(Boolean);
}

const normalize = (word: string) => word.replace(TRAILING_PUNCTUATION, "").toLowerCase();

function isConjunctionAt(words: readonly string[], index: number): boolean {
  const word = normalize(words[index] ?? "");
  if (SINGLE_CONJUNCTIONS.has(word)) return true;
  const next = words[index + 1];
  return next !== undefined && PHRASE_CONJUNCTIONS.has(`${word} ${normalize(next)}`);
}

/** True when the last part of `words` holds a clause boundary (punctuation or conjunction). */
export function hasSemanticBoundary(words: readonly string[], config: SegmenterConfig): boolean {
  const start = Math.floor(words.length * (1 - config.semanticTailRatio));
  for (let i = start; i < words.length - 1; i++) {
    if (CLAUSE_PUNCTUATION.test(words[i] ?? "") || isConjunctionAt(words, i)) return true;
  }
  return SENTENCE_PUNCTUATION.test(words[words.length - 1] ?? "");
}

export function exceedsHardCap(
  words: readonly string[],
  config: SegmenterConfig,
  carryWords = 0,
): boolean {
  return (
    words.length + carryWords >= config.hardMaxWords ||
    words.join(" ").length >= config.hardMaxChars
  );
}

export function shouldSemanticCut(words: readonly string[], config: SegmenterConfig): boolean {
  return words.length >= config.semanticMinWords && hasSemanticBoundary(words, config);
}

export function meetsSilenceMinimum(words: readonly string[], config: SegmenterConfig): boolean {
  return words.length >= config.minWords;
}
