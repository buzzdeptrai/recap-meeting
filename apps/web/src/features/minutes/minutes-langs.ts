import type { MinutesLang } from "@recap/core";

/** Display names, in the order the language switch shows them (English first: the default source). */
export const MINUTES_LANG_ORDER: readonly MinutesLang[] = ["en", "vi"];
export const DEFAULT_SOURCE_LANG: MinutesLang = "en";

const NAME: Record<MinutesLang, string> = { vi: "tiếng Việt", en: "tiếng Anh" };

/** "tiếng Việt" / "tiếng Anh" (lower case, for use inside a sentence). */
export const langName = (lang: MinutesLang): string => NAME[lang];

/** "Tiếng Việt" / "Tiếng Anh" (for switches and labels). */
export const langTitle = (lang: MinutesLang): string => {
  const name = NAME[lang];
  return name.charAt(0).toUpperCase() + name.slice(1);
};

export const otherMinutesLang = (lang: MinutesLang): MinutesLang => (lang === "vi" ? "en" : "vi");

/** Badge text of a translated version. */
export const derivedBadgeText = (from: MinutesLang): string => `Bản dịch từ ${langName(from)}`;

/** Info line on the source tab while the other language is being translated. */
export const translatingNotice = (into: MinutesLang): string =>
  `Đang dịch sang ${langName(into)}. Bản này dùng được ngay.`;
