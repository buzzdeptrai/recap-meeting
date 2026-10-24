/**
 * Local, offline language guess for a segment's text. Used only when the STT provider did not
 * report a language (AssemblyAI streaming rarely does). Deliberately conservative: a wrongly
 * skipped segment loses a translation, a wrongly translated one only costs a call, so anything
 * not clearly Vietnamese or English is "unknown".
 */
export type DetectedLanguage = "vi" | "en" | "unknown";

/** Minimum alphabetic words before we trust a guess (names / "OK" / fragments stay unknown). */
export const MIN_WORDS = 3;
/** Share of words with Vietnamese-specific letters. Real VI speech sits near 90-100%. */
export const VI_WORD_SHARE = 0.6;
/** Share of common English function words. Real EN speech is roughly 30-60%. */
export const EN_STOPWORD_SHARE = 0.25;

// ă â đ ê ô ơ ư plus every tone-marked vowel, matched on NFC text.
const VIETNAMESE_LETTER = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
const PLAIN_LATIN_WORD = /^[a-z0-9']+$/i;
const WORD_SPLIT = /[^\p{L}\p{N}'’]+/u;

const ENGLISH_STOPWORDS = new Set(
  (
    "the a an and or but so if of to in on at for with from by as is are was were be been am " +
    "i you he she it we they me my your our their this that these those there here what when " +
    "which who how why do does did have has had will would can could should just not no yes " +
    "about like than then them its it's i'm i've i'd don't can't we're they're that's you're " +
    "all some any more very really kind"
  ).split(" "),
);

function tokenize(text: string): string[] {
  return text
    .normalize("NFC")
    .split(WORD_SPLIT)
    .map((w) => w.replace(/’/g, "'"))
    .filter((w) => /\p{L}/u.test(w));
}

function isVietnamese(words: string[]): boolean {
  const marked = words.filter((w) => VIETNAMESE_LETTER.test(w)).length;
  return marked / words.length >= VI_WORD_SHARE;
}

function isEnglish(words: string[]): boolean {
  if (!words.every((w) => PLAIN_LATIN_WORD.test(w))) return false;
  const stop = words.filter((w) => ENGLISH_STOPWORDS.has(w.toLowerCase())).length;
  return stop > 0 && stop / words.length >= EN_STOPWORD_SHARE;
}

export function detectLanguage(text: string): DetectedLanguage {
  const words = tokenize(text);
  if (words.length < MIN_WORDS) return "unknown";
  if (isVietnamese(words)) return "vi";
  if (isEnglish(words)) return "en";
  return "unknown";
}
