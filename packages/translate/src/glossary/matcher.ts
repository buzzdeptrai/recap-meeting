import type { Lang } from "../types";
import { extractSearchPatterns, foldDiacritics, wordBoundaryRegex } from "./normalize";
import type { GlossaryMatch, GlossaryTerm } from "./types";

export const DEFAULT_MAX_GLOSSARY_TERMS = 15;

export interface CompiledTerm {
  term: GlossaryTerm;
  patterns: { length: number; regex: RegExp }[];
}

export type SourceLangHint = Lang | "auto" | "multi";

export function compileTerm(term: GlossaryTerm): CompiledTerm {
  const texts = [term.term, ...(term.variants ?? [])];
  const unique = new Set(texts.flatMap((t) => extractSearchPatterns(t)));
  return {
    term,
    patterns: [...unique].map((p) => ({ length: p.length, regex: wordBoundaryRegex(p) })),
  };
}

/**
 * A term is usable for a direction when it is written in the source language (any language
 * for auto/multi) and yields something for the target: either "keep as is" or a translation
 * that is not already in the target language.
 */
export function isUsable(
  term: GlossaryTerm,
  sourceLang: SourceLangHint,
  targetLang: Lang,
): boolean {
  const langOk = sourceLang === "auto" || sourceLang === "multi" || term.lang === sourceLang;
  if (!langOk) return false;
  if (term.doNotTranslate) return true;
  return Boolean(term.translation) && term.lang !== targetLang;
}

/** Matching terms, ordered by priority then longest match, capped at `max`. */
export function findMatches(
  compiled: readonly CompiledTerm[],
  text: string,
  sourceLang: SourceLangHint,
  targetLang: Lang,
  max = DEFAULT_MAX_GLOSSARY_TERMS,
): GlossaryMatch[] {
  const folded = foldDiacritics(text);
  const matches: GlossaryMatch[] = [];
  for (const { term, patterns } of compiled) {
    if (!isUsable(term, sourceLang, targetLang)) continue;
    const hit = patterns.filter((p) => p.regex.test(folded));
    if (hit.length === 0) continue;
    matches.push({ term, matchedLength: Math.max(...hit.map((p) => p.length)) });
  }
  matches.sort((a, b) => b.term.priority - a.term.priority || b.matchedLength - a.matchedLength);
  return matches.slice(0, max);
}

/** Prompt lines for the [MANDATORY GLOSSARY] block. */
export function toGlossaryLines(matches: readonly GlossaryMatch[]): string[] {
  return matches.map(({ term }) =>
    term.doNotTranslate || !term.translation
      ? `- "${term.term}" -> keep exactly as written (do not translate)`
      : `- "${term.term}" -> "${term.translation}"`,
  );
}
