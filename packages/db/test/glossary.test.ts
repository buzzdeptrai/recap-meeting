import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

describe("glossary repository", () => {
  it("creates a term with variants and reads it back", () => {
    const { repos } = setup();
    const term = repos.glossary.create({
      term: "Deepgram",
      lang: "en",
      doNotTranslate: true,
      priority: 5,
      variants: ["deep gram", "đíp gram"],
    });
    expect(term).toMatchObject({
      term: "Deepgram",
      lang: "en",
      translation: null,
      doNotTranslate: true,
      priority: 5,
    });
    expect(term.variants.map((v) => v.variant)).toEqual(["deep gram", "đíp gram"]);
    expect(repos.glossary.get(term.id)).toEqual(term);
  });

  it("lists by priority, optionally filtered by lang", () => {
    const { repos } = setup();
    repos.glossary.create({ term: "báo giá", lang: "vi", translation: "quotation", priority: 1 });
    repos.glossary.create({ term: "PO", lang: "en", translation: "đơn đặt hàng", priority: 9 });
    expect(repos.glossary.list().map((t) => t.term)).toEqual(["PO", "báo giá"]);
    expect(repos.glossary.list("vi").map((t) => t.term)).toEqual(["báo giá"]);
  });

  it("updates, manages variants and deletes with cascade", () => {
    const { repos, db } = setup();
    const term = repos.glossary.create({ term: "x", lang: "en" });
    const updated = repos.glossary.update(term.id, { translation: "y", doNotTranslate: true });
    expect(updated).toMatchObject({ term: "x", translation: "y", doNotTranslate: true });
    expect(repos.glossary.update("missing", { term: "z" })).toBeUndefined();

    const variant = repos.glossary.addVariant(term.id, "ex");
    expect(repos.glossary.get(term.id)?.variants).toEqual([variant]);
    expect(repos.glossary.removeVariant(variant.id)).toBe(true);
    repos.glossary.addVariant(term.id, "ecks");

    expect(repos.glossary.remove(term.id)).toBe(true);
    expect(repos.glossary.get(term.id)).toBeUndefined();
    expect(db.prepare("SELECT COUNT(*) FROM term_variants").pluck().get()).toBe(0);
  });
});
