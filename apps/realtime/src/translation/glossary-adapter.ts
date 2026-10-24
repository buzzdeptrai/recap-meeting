import type { GlossarySource } from "@recap/translate";
import type { Repositories } from "@recap/db";

/** Adapts the db glossary (variants as rows) to the translator's `GlossarySource`. */
export function createGlossarySource(repos: Repositories): GlossarySource {
  return {
    listTerms: () =>
      repos.glossary.list().map((term) => ({
        term: term.term,
        lang: term.lang,
        translation: term.translation,
        doNotTranslate: term.doNotTranslate,
        priority: term.priority,
        variants: term.variants.map((variant) => variant.variant),
      })),
  };
}
