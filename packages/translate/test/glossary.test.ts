import { describe, expect, it } from "vitest";
import { createGlossary, type GlossaryTerm } from "../src/glossary";
import { foldDiacritics, extractSearchPatterns } from "../src/glossary/normalize";

const term = (t: Partial<GlossaryTerm> & { term: string }): GlossaryTerm => ({
  lang: "en",
  translation: null,
  doNotTranslate: false,
  priority: 0,
  ...t,
});

function glossaryOf(terms: GlossaryTerm[], maxTerms?: number) {
  return createGlossary({ source: { listTerms: () => terms }, maxTerms });
}

describe("glossary matching", () => {
  it("folds Vietnamese diacritics including đ", () => {
    expect(foldDiacritics("Đồng ý, Ngân sách")).toBe("dong y, ngan sach");
  });

  it("expands ABBR (full) and A / B patterns", () => {
    expect(extractSearchPatterns("KPI (Key Performance Indicator)")).toEqual([
      "KPI (Key Performance Indicator)",
      "KPI",
      "Key Performance Indicator",
    ]);
    expect(extractSearchPatterns("A1 / B1")).toEqual(["A1 / B1", "A1", "B1"]);
  });

  it("matches VI terms regardless of diacritics and case", async () => {
    const g = glossaryOf([term({ term: "Ngân sách", lang: "vi", translation: "budget" })]);
    expect(await g.select("chung ta can duyet NGAN SACH quy 3", "vi", "en")).toHaveLength(1);
    expect(await g.select("Chúng ta duyệt ngân sách.", "vi", "en")).toHaveLength(1);
  });

  it("respects word boundaries", async () => {
    const g = glossaryOf([term({ term: "ARR", translation: "doanh thu định kỳ hằng năm" })]);
    expect(await g.select("the carrier is late", "en", "vi")).toHaveLength(0);
    expect(await g.select("our ARR grew (ARR), nice", "en", "vi")).toHaveLength(1);
  });

  it("matches the abbreviation or the full form of 'ABBR (full)'", async () => {
    const g = glossaryOf([
      term({ term: "KPI (Key Performance Indicator)", translation: "chỉ số hiệu suất chính" }),
    ]);
    expect(await g.select("what is the KPI", "en", "vi")).toHaveLength(1);
    expect(await g.select("key performance indicator review", "en", "vi")).toHaveLength(1);
  });

  it("matches variants (ASR spellings)", async () => {
    const g = glossaryOf([
      term({ term: "Kubernetes", doNotTranslate: true, variants: ["kuber netties"] }),
    ]);
    expect(await g.select("we run kuber netties in prod", "en", "vi")).toHaveLength(1);
  });

  it("only uses terms of the source language for explicit directions", async () => {
    const g = glossaryOf([term({ term: "budget", lang: "en", translation: "ngân sách" })]);
    expect(await g.select("budget", "vi", "en")).toHaveLength(0);
    expect(await g.select("budget", "en", "vi")).toHaveLength(1);
  });

  it("uses terms of both languages for auto/multi but never translates into the term's own language", async () => {
    const g = glossaryOf([
      term({ term: "deadline", lang: "en", translation: "hạn chót" }),
      term({ term: "ngân sách", lang: "vi", translation: "budget" }),
    ]);
    const toVi = await g.select("deadline và ngân sách", "multi", "vi");
    expect(toVi.map((m) => m.term.term)).toEqual(["deadline"]);
  });

  it("selects the highest-priority terms up to the cap, longest first on ties", async () => {
    const terms = Array.from({ length: 20 }, (_, i) =>
      term({ term: `term${String(i).padStart(2, "0")}`, translation: `t${i}`, priority: i % 2 }),
    );
    const text = terms.map((t) => t.term).join(" ");
    const picked = await glossaryOf(terms, 15).select(text, "en", "vi");
    expect(picked).toHaveLength(15);
    expect(picked.slice(0, 10).every((m) => m.term.priority === 1)).toBe(true);
  });

  it("renders mandatory and do-not-translate lines", async () => {
    const g = glossaryOf([
      term({ term: "budget", translation: "ngân sách" }),
      term({ term: "Zalo", doNotTranslate: true, priority: 1 }),
    ]);
    const lines = g.lines(await g.select("Zalo budget", "en", "vi"));
    expect(lines).toEqual([
      '- "Zalo" -> keep exactly as written (do not translate)',
      '- "budget" -> "ngân sách"',
    ]);
  });

  it("survives a failing source", async () => {
    const g = createGlossary({
      source: {
        listTerms: () => {
          throw new Error("db down");
        },
      },
    });
    expect(await g.select("anything", "en", "vi")).toEqual([]);
  });
});
