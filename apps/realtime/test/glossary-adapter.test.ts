import { IN_MEMORY, createRepositories, openDatabase } from "@recap/db";
import { describe, expect, it } from "vitest";
import { createGlossarySource } from "../src/translation/glossary-adapter";

describe("createGlossarySource", () => {
  it("maps db terms to translator terms with variants as strings", async () => {
    const repos = createRepositories(openDatabase(IN_MEMORY));
    repos.glossary.create({
      term: "Deepgram",
      lang: "en",
      doNotTranslate: true,
      priority: 5,
      variants: ["deep gram", "dip gram"],
    });
    const terms = await createGlossarySource(repos).listTerms();
    expect(terms).toEqual([
      {
        term: "Deepgram",
        lang: "en",
        translation: null,
        doNotTranslate: true,
        priority: 5,
        variants: ["deep gram", "dip gram"],
      },
    ]);
  });
});
