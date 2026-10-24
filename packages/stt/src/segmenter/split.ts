const SENTENCE_SPLIT = /(?<=[。！？.!?])\s*/;
const CLAUSE_SPLIT = /(?<=[，,；;：:])\s*/;

/** Greedily packs pieces into chunks of at most `maxChars` (a lone long piece stays whole). */
function pack(pieces: string[], maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (!piece.trim()) continue;
    if (current && current.length + piece.length > maxChars) {
      chunks.push(current.trim());
      current = piece;
    } else {
      current += current ? ` ${piece}` : piece;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Splits an oversized final at sentence boundaries, then clause boundaries. */
export function splitLongText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const sentences = pack(text.split(SENTENCE_SPLIT), maxChars);
  const result = sentences.flatMap((chunk) =>
    chunk.length <= maxChars ? [chunk] : pack(chunk.split(CLAUSE_SPLIT), maxChars),
  );
  return result.length > 0 ? result : [text];
}
