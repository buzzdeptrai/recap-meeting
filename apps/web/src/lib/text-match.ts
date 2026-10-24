/**
 * Client-side twin of the server's transcript search matching (`@recap/db` meeting-search):
 * a word matches when, lower-cased with tone marks removed and đ folded to d, it starts with a
 * query term. Used to mark the matched words inside rendered rows.
 */
const WORD = /[\p{L}\p{N}\p{M}]+/gu;

export function foldWord(word: string): string {
  return word.toLowerCase().replaceAll("đ", "d").normalize("NFD").replace(/\p{M}/gu, "");
}

export interface TextPart {
  text: string;
  hit: boolean;
}

/** `text` cut into runs; `hit` runs are the words that start with one of `terms` (already folded). */
export function splitByTerms(text: string, terms: readonly string[]): TextPart[] {
  if (terms.length === 0) return [{ text, hit: false }];
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(WORD)) {
    const word = foldWord(match[0]);
    if (!terms.some((term) => word.startsWith(term))) continue;
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index), hit: false });
    parts.push({ text: match[0], hit: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length || parts.length === 0)
    parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}
