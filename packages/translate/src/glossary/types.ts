import type { Lang } from "../types";

/** A glossary entry. `term` is written in `lang`; `translation` is in the other language. */
export interface GlossaryTerm {
  term: string;
  lang: Lang;
  translation: string | null;
  /** Keep the term verbatim in the output (product names, acronyms). */
  doNotTranslate: boolean;
  /** Higher wins when more than the prompt limit match. */
  priority: number;
  /** Alternative spellings / ASR variants that should also trigger this term. */
  variants?: readonly string[];
}

/** Where terms come from. The db package adapts to this; this package never imports it. */
export interface GlossarySource {
  listTerms(): GlossaryTerm[] | Promise<GlossaryTerm[]>;
}

export interface GlossaryMatch {
  term: GlossaryTerm;
  /** Length of the longest pattern that matched, used for longest-first ordering. */
  matchedLength: number;
}
