const COMBINING_MARKS = /[\u0300-\u036f]/g;
const MIN_PATTERN_LENGTH = 2;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/** Lowercase and strip Vietnamese (and other) diacritics so "Ngân sách" matches "ngan sach". */
export function foldDiacritics(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "").replace(/đ/g, "d");
}

/**
 * Search patterns for one term string:
 *   "ABBR (Full name)" -> the whole string, "ABBR", "Full name"
 *   "A / B"            -> the whole string, "A", "B"
 */
export function extractSearchPatterns(termText: string): string[] {
  const patterns = new Set<string>([termText.trim()]);
  const paren = /^(.+?)\s*\((.+)\)$/.exec(termText.trim());
  if (paren) {
    patterns.add((paren[1] ?? "").trim());
    patterns.add((paren[2] ?? "").trim());
  }
  if (termText.includes(" / ")) {
    for (const part of termText.split(" / ")) patterns.add(part.trim());
  }
  return [...patterns].filter((p) => p.length >= MIN_PATTERN_LENGTH);
}

/** Whole-word, case/diacritic-insensitive matcher for a folded pattern. */
export function wordBoundaryRegex(pattern: string): RegExp {
  const escaped = foldDiacritics(pattern).replace(REGEX_SPECIALS, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u");
}
