import type { SourceLang, TargetLang } from "@recap/core";
import type { ContextPair } from "./context";

const LANGUAGE_NAMES: Record<TargetLang, string> = { vi: "Vietnamese", en: "English" };

const COMMON_RULES = [
  "STRICT RULES:",
  '1. MANDATORY GLOSSARY: If terms appear in [MANDATORY GLOSSARY FOR THIS CHUNK], use exactly the listed rendering. Do not use synonyms. Entries marked "keep exactly as written" must stay untouched.',
  "2. CONTEXT: Use [PREVIOUS CONTEXT] only to resolve pronouns, keep tense and terminology consistent, and make the output read naturally after the previous sentences. Never repeat or re-translate previous sentences.",
  "3. NORMALIZE: The input is raw speech-to-text. Silently fix obvious recognition errors, punctuation and word-boundary mistakes before translating.",
  "4. FILLERS: Remove filler words (um, uh, you know, like, I mean; ờ, ừm, à, thì là, kiểu như) entirely; do not translate them.",
  "5. DISFLUENCY: If the speaker stutters or restarts a sentence, translate only the final intended meaning. Drop false starts and repetitions.",
  "6. EXACTNESS: Keep names of people, companies and products, numbers, dates, currencies and units exact. Do not round, convert or invent anything.",
  "7. STYLE: Natural business-meeting register. Translate ideas, not word by word.",
  "8. OUTPUT: Return ONLY the translation of [LATEST TEXT TO TRANSLATE]. No notes, no quotes, no markdown, no explanations.",
];

/** Extra rules when the text may be Vietnamese speech-to-text (source vi, auto or multi). */
const VIETNAMESE_SOURCE_RULES = [
  "VIETNAMESE SOURCE RULES (apply whenever the text is Vietnamese):",
  "9. MOOD: Keep declarative sentences declarative. Never turn a statement or a fragment into a question unless it contains a question word (ai, gì, nào, đâu, sao, bao nhiêu, bao giờ, thế nào...) or a clear question marker (không?, phải không, đúng không, chưa?, à?, hả, nhỉ).",
  "10. PRONOUNS: mình/tớ/tôi/tao follow the speaker and the pairs in [PREVIOUS CONTEXT]; copy how earlier pairs rendered them. Default to a neutral first person (I / we) when unsure. Do not switch between I and we without evidence.",
  "11. FRAGMENTS: [LATEST TEXT TO TRANSLATE] may be an incomplete phrase that continues the previous context (speech is cut into chunks). Translate only what is said; never invent or guess the missing part.",
];

function mayBeVietnamese(source: SourceLang): boolean {
  return source !== "en";
}

function header(source: SourceLang, target: TargetLang): string[] {
  const to = LANGUAGE_NAMES[target];
  if (source === "en" && target === "vi") {
    return [
      "You are an expert real-time interpreter for business meetings, translating English into Vietnamese.",
    ];
  }
  if (source === "vi" && target === "en") {
    return [
      "You are an expert real-time interpreter for business meetings, translating Vietnamese into English.",
    ];
  }
  return [
    "You are an expert real-time interpreter for business meetings.",
    `Detect the source language of the text (it may mix Vietnamese and English) and translate it into ${to}.`,
    `If the text is already entirely in ${to}, return it with only minor cleanup.`,
  ];
}

export function buildSystemPrompt(source: SourceLang, target: TargetLang): string {
  const extra = mayBeVietnamese(source) ? ["", ...VIETNAMESE_SOURCE_RULES] : [];
  return [...header(source, target), "", ...COMMON_RULES, ...extra].join("\n");
}

export interface UserPromptInput {
  text: string;
  context: readonly ContextPair[];
  glossaryLines: readonly string[];
}

const NONE = "None";

export function buildUserPrompt({ text, context, glossaryLines }: UserPromptInput): string {
  const contextBlock = context.length
    ? context.map((c) => `- "${c.source}" => "${c.translation}"`).join("\n")
    : NONE;
  const glossaryBlock = glossaryLines.length ? glossaryLines.join("\n") : NONE;
  return [
    "[PREVIOUS CONTEXT (for reference only)]:",
    contextBlock,
    "",
    "[MANDATORY GLOSSARY FOR THIS CHUNK]:",
    glossaryBlock,
    "",
    "[LATEST TEXT TO TRANSLATE]:",
    text.trim(),
  ].join("\n");
}
