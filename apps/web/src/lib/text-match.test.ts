import { describe, expect, it } from "vitest";
import { foldWord, splitByTerms } from "./text-match";

describe("foldWord", () => {
  it("lowercases and drops tone marks, folding đ", () => {
    expect(foldWord("Đàm")).toBe("dam");
    expect(foldWord("PHÁN")).toBe("phan");
  });
});

describe("splitByTerms", () => {
  it("marks words starting with a term, ignoring case and diacritics", () => {
    expect(splitByTerms("Đàm phán hợp đồng", ["dam", "hop"])).toEqual([
      { text: "Đàm", hit: true },
      { text: " phán ", hit: false },
      { text: "hợp", hit: true },
      { text: " đồng", hit: false },
    ]);
  });

  it("returns the whole text when nothing matches or there are no terms", () => {
    expect(splitByTerms("không có", ["xyz"])).toEqual([{ text: "không có", hit: false }]);
    expect(splitByTerms("abc", [])).toEqual([{ text: "abc", hit: false }]);
    expect(splitByTerms("", ["a"])).toEqual([{ text: "", hit: false }]);
  });

  it("matches prefixes only, not substrings, and keeps trailing text", () => {
    expect(splitByTerms("price prices spice.", ["pric"])).toEqual([
      { text: "price", hit: true },
      { text: " ", hit: false },
      { text: "prices", hit: true },
      { text: " spice.", hit: false },
    ]);
  });
});
