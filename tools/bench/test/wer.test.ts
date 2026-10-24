import { describe, expect, it } from "vitest";
import { cer, editDistance, normalizeText, tokenize, wer } from "../src/wer";

describe("normalizeText", () => {
  it("lowercases, strips punctuation, collapses spaces, keeps Vietnamese diacritics", () => {
    expect(normalizeText("  Chúng ta,  HOLD   giá ở 345!  ")).toBe("chúng ta hold giá ở 345");
    expect(normalizeText("Don't stop — it's “fine”.")).toBe("dont stop its fine");
  });

  it("treats composed and decomposed diacritics as equal", () => {
    const composed = "Việt Nam";
    const decomposed = "Việt Nam";
    expect(normalizeText(decomposed)).toBe(normalizeText(composed));
  });

  it("keeps diacritics significant", () => {
    expect(normalizeText("má")).not.toBe(normalizeText("ma"));
  });
});

describe("editDistance", () => {
  it("handles empty and basic cases", () => {
    expect(editDistance([], ["a"])).toBe(1);
    expect(editDistance(["a", "b"], [])).toBe(2);
    expect(editDistance([..."kitten"], [..."sitting"])).toBe(3);
  });
});

describe("wer / cer", () => {
  it("is zero for identical text modulo case and punctuation", () => {
    expect(wer("Xin chào, mọi người!", "xin chào mọi người").rate).toBe(0);
  });

  it("counts a tone error as a word error", () => {
    const result = wer("chúng ta họp ngày mai", "chúng ta hộp ngày mai");
    expect(result.distance).toBe(1);
    expect(result.rate).toBeCloseTo(0.2);
  });

  it("counts insertions, deletions and substitutions on mixed EN-VI text", () => {
    const reference = "we hold the price at 345 nếu họ ký quý này";
    const hypothesis = "we hold price at 345 nếu họ ký quý này nhé";
    const result = wer(reference, hypothesis);
    expect(result.distance).toBe(2); // one deletion ("the"), one insertion ("nhé")
    expect(result.referenceLength).toBe(11);
  });

  it("returns NaN for an empty reference and tokenizes empty text to nothing", () => {
    expect(wer("", "anything").rate).toBeNaN();
    expect(tokenize("  ,.  ")).toEqual([]);
  });

  it("computes character error rate with diacritics", () => {
    const result = cer("việt nam", "viet nam");
    expect(result.distance).toBe(1); // composed "ệ" → "e" is a single substitution
    expect(result.referenceLength).toBe(8);
  });
});
