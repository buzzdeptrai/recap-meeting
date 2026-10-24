/** One known ASR mis-hearing and the term it should be replaced with. */
export interface VariantEntry {
  variant: string;
  canonical: string;
}

/** Injected source of variants (e.g. built from the glossary at session start). */
export type VariantSource = () => readonly VariantEntry[];

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const escapeRegex = (value: string) => value.replace(REGEX_SPECIALS, "\\$&");

interface CompiledVariant {
  pattern: RegExp;
  canonical: string;
}

/** Unicode-aware word boundaries (JS `\b` is ASCII-only and breaks on Vietnamese letters). */
function compile(entries: readonly VariantEntry[]): CompiledVariant[] {
  return entries
    .filter((entry) => entry.variant.trim().length > 0)
    .sort((a, b) => b.variant.length - a.variant.length)
    .map((entry) => ({
      pattern: new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegex(entry.variant.trim())}(?![\\p{L}\\p{N}])`,
        "giu",
      ),
      canonical: entry.canonical,
    }));
}

/**
 * Returns a function applying longest-first variant replacement. The compiled patterns are
 * cached until the source returns a different array instance.
 */
export function createVariantCorrector(source: VariantSource): (text: string) => string {
  let lastEntries: readonly VariantEntry[] | null = null;
  let compiled: CompiledVariant[] = [];
  return (text) => {
    const entries = source();
    if (entries !== lastEntries) {
      lastEntries = entries;
      compiled = compile(entries);
    }
    return compiled.reduce((acc, { pattern, canonical }) => acc.replace(pattern, canonical), text);
  };
}
