import { describe, expect, it } from "vitest";
import { ContextStore } from "../src/context";
import { buildSystemPrompt, buildUserPrompt } from "../src/prompts";

describe("ContextStore", () => {
  it("keeps only the last 6 pairs per meeting, isolated between meetings", () => {
    const store = new ContextStore();
    for (let i = 1; i <= 8; i++) store.push("m1", { source: `s${i}`, translation: `t${i}` });
    store.push("m2", { source: "x", translation: "y" });
    expect(store.recent("m1").map((p) => p.source)).toEqual(["s3", "s4", "s5", "s6", "s7", "s8"]);
    expect(store.recent("m2")).toHaveLength(1);
    store.clear("m1");
    expect(store.recent("m1")).toEqual([]);
  });
});

describe("prompts", () => {
  it("builds direction-specific system prompts with all interpreter rules", () => {
    const enVi = buildSystemPrompt("en", "vi");
    expect(enVi).toContain("English into Vietnamese");
    expect(buildSystemPrompt("vi", "en")).toContain("Vietnamese into English");
    for (const rule of [
      "MANDATORY GLOSSARY",
      "NORMALIZE",
      "FILLERS",
      "DISFLUENCY",
      "EXACTNESS",
      "ONLY the translation",
    ]) {
      expect(enVi).toContain(rule);
    }
  });

  it("adds Vietnamese source rules for vi/auto/multi but not for English sources", () => {
    for (const source of ["vi", "auto", "multi"] as const) {
      const prompt = buildSystemPrompt(source, "en");
      expect(prompt).toContain("Keep declarative sentences declarative");
      expect(prompt).toContain("mình/tớ/tôi/tao");
      expect(prompt).toContain("never invent or guess the missing part");
    }
    expect(buildSystemPrompt("en", "vi")).not.toContain("VIETNAMESE SOURCE RULES");
  });

  it("uses the auto-detect prompt for auto/multi", () => {
    expect(buildSystemPrompt("auto", "vi")).toContain("Detect the source language");
    expect(buildSystemPrompt("multi", "en")).toContain("into English");
  });

  it("composes the three user-prompt blocks in order", () => {
    const prompt = buildUserPrompt({
      text: "  Hello team  ",
      context: [{ source: "Hi", translation: "Chào" }],
      glossaryLines: ['- "ARR" -> "doanh thu"'],
    });
    const iContext = prompt.indexOf("[PREVIOUS CONTEXT");
    const iGlossary = prompt.indexOf("[MANDATORY GLOSSARY");
    const iLatest = prompt.indexOf("[LATEST TEXT TO TRANSLATE]:\nHello team");
    expect(iContext).toBeLessThan(iGlossary);
    expect(iGlossary).toBeLessThan(iLatest);
    expect(prompt).toContain('- "Hi" => "Chào"');
    expect(prompt).toContain('- "ARR" -> "doanh thu"');
  });

  it("writes None for empty context and glossary", () => {
    const prompt = buildUserPrompt({ text: "x", context: [], glossaryLines: [] });
    expect(prompt.match(/None/g)).toHaveLength(2);
  });
});

describe("default context size", () => {
  it("is 6 pairs and the prompt stays small", () => {
    const store = new ContextStore();
    for (let i = 1; i <= 6; i++) {
      store.push("m", {
        source: "một câu tiếng Việt khá dài ".repeat(3),
        translation: "x ".repeat(25),
      });
    }
    const prompt = buildUserPrompt({ text: "hi", context: store.recent("m"), glossaryLines: [] });
    expect(store.recent("m")).toHaveLength(6);
    expect(prompt.length).toBeLessThan(2_000);
  });
});

describe("technical terms rule", () => {
  it("tells the model to keep English business/IT terms like tier unchanged", () => {
    for (const source of ["en", "auto", "multi", "vi"] as const) {
      const prompt = buildSystemPrompt(source, "vi");
      expect(prompt).toContain("TERMS: Keep widely used English business/IT terms");
      expect(prompt).toContain("tier");
    }
  });
});
