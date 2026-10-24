import { describe, expect, it } from "vitest";
import { resolveDirection } from "../src/translation/direction";

const toVi = { sourceLang: "multi", targetLang: "vi" } as const;
const viToEn = { sourceLang: "vi", targetLang: "en" } as const;

describe("resolveDirection", () => {
  it("translates the other language into the target", () => {
    expect(resolveDirection("en", toVi)).toEqual({ sourceLang: "en", targetLang: "vi" });
    expect(resolveDirection("en-US", toVi)).toEqual({ sourceLang: "en", targetLang: "vi" });
    expect(resolveDirection("vi", { sourceLang: "multi", targetLang: "en" })).toEqual({
      sourceLang: "vi",
      targetLang: "en",
    });
  });

  it("skips text already in the target language", () => {
    expect(resolveDirection("vi", toVi)).toBeNull();
    expect(resolveDirection("VI-VN", toVi)).toBeNull();
  });

  it("uses the fixed session source for unknown language, else auto", () => {
    expect(resolveDirection(null, viToEn)).toEqual({ sourceLang: "vi", targetLang: "en" });
    expect(resolveDirection(null, toVi)).toEqual({ sourceLang: "auto", targetLang: "vi" });
    expect(resolveDirection("fr", toVi)).toEqual({ sourceLang: "auto", targetLang: "vi" });
  });

  describe("with segment text (provider language missing)", () => {
    const vi = "bạn chế tạo được một loại nhiên liệu mới.";
    const en = "Just, it's kind of what I've been preaching the whole time.";
    const toEn = { sourceLang: "multi", targetLang: "en" } as const;

    it("provider label is kept when the text is unsure, and used without text", () => {
      expect(resolveDirection("en", toVi)).toEqual({ sourceLang: "en", targetLang: "vi" });
      expect(resolveDirection("vi", toVi, "OK")).toBeNull();
      expect(resolveDirection("en", toVi, "Jaden")).toEqual({ sourceLang: "en", targetLang: "vi" });
    });

    it("confident text beats a stale provider label", () => {
      const seq131 =
        "as a platform. Then we should specifically call out that they have zero. So GitHub";
      expect(resolveDirection("vi", toVi, seq131)).toEqual({ sourceLang: "en", targetLang: "vi" });
      expect(resolveDirection("en", toVi, vi)).toBeNull();
      expect(resolveDirection("en", toEn, vi)).toEqual({ sourceLang: "vi", targetLang: "en" });
    });

    it("skips Vietnamese text when the target is Vietnamese", () => {
      expect(resolveDirection(null, toVi, vi)).toBeNull();
      expect(resolveDirection("", toVi, vi)).toBeNull();
      expect(resolveDirection(null, viToEn, vi)).toEqual({ sourceLang: "vi", targetLang: "en" });
    });

    it("translates English text into Vietnamese, and skips it for an English target", () => {
      expect(resolveDirection(null, toVi, en)).toEqual({ sourceLang: "en", targetLang: "vi" });
      expect(resolveDirection(null, toEn, en)).toBeNull();
      expect(resolveDirection(null, toEn, vi)).toEqual({ sourceLang: "vi", targetLang: "en" });
    });

    it("keeps the old behaviour when the text is unknown", () => {
      expect(resolveDirection(null, toVi, "OK")).toEqual({ sourceLang: "auto", targetLang: "vi" });
      expect(resolveDirection(null, viToEn, "OK")).toEqual({ sourceLang: "vi", targetLang: "en" });
      expect(resolveDirection("fr", toVi, "")).toEqual({ sourceLang: "auto", targetLang: "vi" });
    });
  });
});
