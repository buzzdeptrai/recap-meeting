import type { MinutesContent, MinutesLang } from "@recap/core";
import { DEFAULT_GENERATOR_CONFIG } from "./config";
import { glossaryLines } from "./glossary-lines";
import { callStructuredWith } from "./structured";
import { translatePrompt, translateSystem } from "./translate-prompts";
import {
  TRANSLATE_SCHEMA_NAME,
  extractText,
  parseTranslation,
  translateJsonSchema,
} from "./translate-schema";
import type { MinutesLlm, MinutesRepos } from "./types";

export interface TranslateMinutesInput {
  meetingTitle: string;
  content: MinutesContent;
  from: MinutesLang;
  to: MinutesLang;
}

export interface TranslateMinutesDeps {
  repos: Pick<MinutesRepos, "glossary">;
  llm: MinutesLlm;
  maxGlossaryTerms?: number;
}

/** The other minutes language: where a translation of `lang` goes. */
export const otherLang = (lang: MinutesLang): MinutesLang => (lang === "vi" ? "en" : "vi");

/**
 * Translates the prose of minutes with one small model call. Ids, timestamps, statuses and
 * marked flags are never sent to the model (they are copied from the source), the input is
 * wrapped as data, glossary terms are applied, and the reply is validated (one retry).
 */
export async function translateMinutes(
  input: TranslateMinutesInput,
  deps: TranslateMinutesDeps,
): Promise<MinutesContent> {
  const glossary = glossaryLines(
    deps.repos,
    deps.maxGlossaryTerms ?? DEFAULT_GENERATOR_CONFIG.maxGlossaryTerms,
  );
  return callStructuredWith(
    deps.llm,
    {
      schemaName: TRANSLATE_SCHEMA_NAME,
      jsonSchema: translateJsonSchema(),
      parse: parseTranslation(input.content),
    },
    {
      system: translateSystem(input.from, input.to),
      user: translatePrompt(input.meetingTitle, glossary, extractText(input.content)),
    },
  );
}
