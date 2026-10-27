/**
 * Function words that cannot end a subtitle chunk: cutting right after one leaves the sentence
 * hanging and the translator guesses ("damage from the" | "steroids ..."). Extend the lists freely;
 * entries are lowercase, NFC, without punctuation.
 */
const ENGLISH_DEPENDENT_WORDS = [
  // articles, determiners
  ...["a", "an", "the", "some", "any", "each", "every", "another", "no"],
  // prepositions
  ...["of", "in", "on", "at", "for", "with", "from", "by", "to", "into", "onto", "about", "over"],
  ...["under", "between", "through", "during", "after", "before", "against", "without", "within"],
  ...["upon", "via", "per", "across", "around", "among", "toward", "towards", "than", "as"],
  // conjunctions and relativisers
  ...["and", "or", "but", "if", "that", "which", "who", "whom", "whose", "whether", "because"],
  ...["while", "although", "though", "unless", "until", "when", "where", "so", "nor", "since"],
  // auxiliaries and "to be"
  ...["is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did", "have", "has"],
  ...["had", "will", "would", "can", "could", "shall", "should", "may", "might", "must", "not"],
  // subject pronouns, possessives, demonstratives
  ...["i", "we", "you", "they", "he", "she", "it", "this", "these", "those", "there"],
  ...["my", "our", "your", "his", "her", "their", "its", "also", "very", "more", "most", "such"],
  // light verbs that need an object or complement
  ...["got", "get", "gets", "getting", "going", "gonna", "wanna", "make", "makes", "made", "let"],
  ...["take", "takes", "took", "give", "gives", "gave", "many", "much", "several", "other"],
  // contractions
  ...["don't", "doesn't", "didn't", "can't", "won't", "wouldn't", "couldn't", "shouldn't"],
  ...["isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't", "hadn't", "it's", "that's"],
  ...["there's", "he's", "she's", "what's", "here's", "i'm", "you're", "we're", "they're"],
  ...[
    "i'll",
    "we'll",
    "you'll",
    "they'll",
    "i've",
    "we've",
    "you've",
    "they've",
    "i'd",
    "we'd",
    "let's",
  ],
];

const VIETNAMESE_DEPENDENT_WORDS = [
  // conjunctions
  ...["và", "hoặc", "hay", "nhưng", "mà", "thì", "nếu", "khi", "vì", "bởi", "nên", "rằng"],
  ...["tuy", "dù", "nhằm", "cùng", "còn"],
  // prepositions
  ...["của", "cho", "với", "để", "trong", "trên", "dưới", "về", "từ", "tại", "ở", "do", "như"],
  ...["bằng", "theo", "qua", "giữa", "sau", "trước", "bị"],
  // copula, aspect markers, quantifiers, nominalisers
  ...["là", "đã", "sẽ", "đang", "rất", "các", "những", "một", "mọi", "mỗi", "sự", "việc"],
  // classifiers ("những cái" | "cái chuyên gia"), "nội" | "dung"
  ...["cái", "con", "chiếc", "nội"],
  // aspect/degree adverbs that need a verb or adjective after them. Deliberately excluded because
  // they often END a clause: không/chưa (tag questions), lại, rồi, nhé, ạ, đấy, thôi, nữa, quá, cả.
  ...["vẫn", "cũng", "chỉ", "vừa", "đều", "hơi", "khá"],
];

export const DEPENDENT_WORDS: ReadonlySet<string> = new Set([
  ...ENGLISH_DEPENDENT_WORDS,
  ...VIETNAMESE_DEPENDENT_WORDS,
]);

const EDGE_QUOTES = /^["'“”‘’([{]+|["'“”‘’)\]}]+$/g;
const ANY_TRAILING_PUNCTUATION = /[.,;:!?…。！？，；：]$/;

/** Lowercase NFC form of a token with quotes stripped and curly apostrophes straightened. */
export function normalizeWord(token: string): string {
  return token.normalize("NFC").replace(/[’‘]/g, "'").replace(EDGE_QUOTES, "").toLowerCase();
}

/**
 * True when `token` is a function word with no punctuation after it. A token followed by
 * punctuation (`"and,"`, `"the."`) already marks a clause edge, so it is a safe place to cut.
 */
export function isDependentWord(token: string | undefined): boolean {
  if (!token) return false;
  const stripped = token.replace(EDGE_QUOTES, "");
  if (ANY_TRAILING_PUNCTUATION.test(stripped)) return false;
  return DEPENDENT_WORDS.has(normalizeWord(stripped));
}

/** Words that never end a sentence even when the vendor adds a full stop after them. */
const OPEN_FUNCTION_WORDS: ReadonlySet<string> = new Set([
  ...["a", "an", "the", "of", "in", "at", "for", "with", "from", "by", "into", "onto"],
  ...["and", "or", "but", "because", "which", "whether", "than", "between", "against"],
  ...["without", "within", "during", "under", "through"],
]);
const TRAILING_STOPS = /[.,;:!?…。！？，；：]+$/;

/** True for an article/preposition/conjunction, with or without trailing punctuation. */
export function isOpenFunctionWord(token: string | undefined): boolean {
  if (!token) return false;
  const bare = token.replace(EDGE_QUOTES, "").replace(TRAILING_STOPS, "");
  return OPEN_FUNCTION_WORDS.has(normalizeWord(bare));
}
