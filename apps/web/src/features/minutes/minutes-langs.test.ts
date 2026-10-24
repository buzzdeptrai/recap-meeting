import { describe, expect, it } from "vitest";
import {
  DEFAULT_SOURCE_LANG,
  MINUTES_LANG_ORDER,
  derivedBadgeText,
  langTitle,
  otherMinutesLang,
  translatingNotice,
} from "./minutes-langs";

describe("minutes langs", () => {
  it("defaults the source to English and lists it first", () => {
    expect(DEFAULT_SOURCE_LANG).toBe("en");
    expect(MINUTES_LANG_ORDER).toEqual(["en", "vi"]);
  });

  it("names languages and the derived badge in Vietnamese", () => {
    expect(langTitle("vi")).toBe("Tiếng Việt");
    expect(langTitle("en")).toBe("Tiếng Anh");
    expect(otherMinutesLang("en")).toBe("vi");
    expect(derivedBadgeText("en")).toBe("Bản dịch từ tiếng Anh");
    expect(derivedBadgeText("vi")).toBe("Bản dịch từ tiếng Việt");
    expect(translatingNotice("vi")).toBe("Đang dịch sang tiếng Việt. Bản này dùng được ngay.");
  });
});
