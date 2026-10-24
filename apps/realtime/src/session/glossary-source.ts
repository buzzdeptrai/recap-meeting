import type { Repositories } from "@recap/db";
import type { VariantEntry } from "@recap/stt";

export interface SttGlossary {
  /** Boosting terms for the STT provider (both languages). */
  keyterms: string[];
  /** ASR mis-hearings → canonical term, applied by the segmenters. */
  variants: VariantEntry[];
}

/** Snapshot of the glossary for one session (loaded once; same array identity is cached). */
export function loadSttGlossary(repos: Repositories): SttGlossary {
  const terms = repos.glossary.list();
  return {
    keyterms: terms.map((term) => term.term),
    variants: terms.flatMap((term) =>
      term.variants.map((variant) => ({ variant: variant.variant, canonical: term.term })),
    ),
  };
}
