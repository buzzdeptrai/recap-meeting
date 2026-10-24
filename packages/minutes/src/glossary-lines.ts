import type { MinutesRepos } from "./types";

/** Glossary entries as prompt lines (do-not-translate terms say "keep as is"). */
export function glossaryLines(repos: Pick<MinutesRepos, "glossary">, maxTerms: number): string[] {
  return repos.glossary
    .list()
    .slice(0, maxTerms)
    .map((t) => {
      if (t.doNotTranslate) return `${t.term} (${t.lang}): keep as is`;
      return t.translation ? `${t.term} (${t.lang}) = ${t.translation}` : `${t.term} (${t.lang})`;
    });
}
