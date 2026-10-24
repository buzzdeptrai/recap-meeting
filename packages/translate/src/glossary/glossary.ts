import { noopLogger, systemClock, type Clock, type Lang, type Logger } from "../types";
import {
  DEFAULT_MAX_GLOSSARY_TERMS,
  compileTerm,
  findMatches,
  toGlossaryLines,
  type CompiledTerm,
  type SourceLangHint,
} from "./matcher";
import type { GlossaryMatch, GlossarySource } from "./types";

const DEFAULT_CACHE_TTL_MS = 60_000;

export interface Glossary {
  /** Matching terms for `text`, highest priority first, at most the configured cap. */
  select(text: string, sourceLang: SourceLangHint, targetLang: Lang): Promise<GlossaryMatch[]>;
  /** Prompt lines for the matches. */
  lines(matches: readonly GlossaryMatch[]): string[];
}

export interface GlossaryOptions {
  source: GlossarySource;
  maxTerms?: number;
  cacheTtlMs?: number;
  clock?: Clock;
  logger?: Logger;
}

/** Glossary with a TTL cache over a source; a failing source never breaks translation. */
export function createGlossary(options: GlossaryOptions): Glossary {
  const clock = options.clock ?? systemClock;
  const logger = options.logger ?? noopLogger;
  const ttl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const max = options.maxTerms ?? DEFAULT_MAX_GLOSSARY_TERMS;
  let compiled: CompiledTerm[] = [];
  let loadedAt = Number.NEGATIVE_INFINITY;

  async function load(): Promise<CompiledTerm[]> {
    if (clock.now() - loadedAt < ttl) return compiled;
    try {
      compiled = (await options.source.listTerms()).map(compileTerm);
      loadedAt = clock.now();
    } catch (err) {
      logger.warn("glossary source failed; using stale terms", { error: String(err) });
      loadedAt = clock.now();
    }
    return compiled;
  }

  return {
    async select(text, sourceLang, targetLang) {
      return findMatches(await load(), text, sourceLang, targetLang, max);
    },
    lines: toGlossaryLines,
  };
}
