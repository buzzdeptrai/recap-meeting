import type { MinutesContent } from "@recap/core";
import { describe, expect, it } from "vitest";
import {
  IN_MEMORY,
  derivedStaleReasons,
  migrations,
  minutesContentHash,
  openDatabase,
} from "../src";
import { setup } from "./helpers";

const content: MinutesContent = {
  summary: "Summary",
  topics: [
    {
      id: "t1",
      title: "Price",
      keyPoints: [{ text: "a", atMs: 1 }],
      status: "decided",
      conclusion: { text: "ok", atMs: 2, marked: true },
    },
  ],
  actionItems: [],
  openIssues: [],
};
const edited: MinutesContent = { ...content, summary: "Edited summary" };

describe("migration 012", () => {
  it("adds the columns on a fresh database with safe defaults", () => {
    const db = openDatabase(IN_MEMORY);
    expect(migrations.at(-1)?.version).toBeGreaterThanOrEqual(12);
    const minutesCols = db.prepare("PRAGMA table_info(minutes)").all() as { name: string }[];
    expect(minutesCols.map((c) => c.name)).toEqual(
      expect.arrayContaining(["derived_from_lang", "source_hash"]),
    );
    const runCols = db.prepare("PRAGMA table_info(minutes_runs)").all() as {
      name: string;
      dflt_value: string | null;
    }[];
    expect(runCols.find((c) => c.name === "kind")?.dflt_value).toBe("'generate'");
    expect(runCols.map((c) => c.name)).toContain("overwrite");
  });

  it("treats rows written without derivation as source rows", () => {
    const { repos } = setup();
    const m = repos.meetings.create({ title: "m" });
    const saved = repos.minutes.upsert({ meetingId: m.id, lang: "vi", content, source: "ai" });
    expect(saved).toMatchObject({ derivedFromLang: null, sourceHash: null });
  });
});

describe("derived minutes rows", () => {
  it("stores provenance of an ai translation and keeps it through user edits", () => {
    const { repos } = setup();
    const m = repos.meetings.create({ title: "m" });
    const sourceHash = minutesContentHash(content);
    repos.minutes.upsert({
      meetingId: m.id,
      lang: "vi",
      content,
      source: "ai",
      derivedFromLang: "en",
      sourceHash,
    });
    const afterEdit = repos.minutes.upsert({
      meetingId: m.id,
      lang: "vi",
      content: edited,
      source: "edited",
    });
    expect(afterEdit).toMatchObject({ source: "edited", derivedFromLang: "en", sourceHash });
  });

  it("a regenerated ai version replaces the provenance (becomes a source row)", () => {
    const { repos } = setup();
    const m = repos.meetings.create({ title: "m" });
    repos.minutes.upsert({
      meetingId: m.id,
      lang: "vi",
      content,
      source: "ai",
      derivedFromLang: "en",
      sourceHash: "h",
    });
    const again = repos.minutes.upsert({ meetingId: m.id, lang: "vi", content, source: "ai" });
    expect(again).toMatchObject({ derivedFromLang: null, sourceHash: null });
  });
});

describe("derivedStaleReasons", () => {
  it("is fresh while the source hash matches, source_edited when it changed", () => {
    const hash = minutesContentHash(content);
    expect(derivedStaleReasons(hash, content)).toEqual([]);
    expect(derivedStaleReasons(hash, edited)).toEqual(["source_edited"]);
  });

  it("never flags unknown hashes or a missing source", () => {
    expect(derivedStaleReasons(null, content)).toEqual([]);
    expect(derivedStaleReasons("h", null)).toEqual([]);
  });

  it("hash is stable for equal content and changes with any text", () => {
    expect(minutesContentHash(content)).toBe(minutesContentHash(structuredClone(content)));
    expect(minutesContentHash(content)).not.toBe(minutesContentHash(edited));
  });
});

describe("minutes runs kind", () => {
  it("defaults to generate, stores translate + overwrite, and reports the active kind", () => {
    const { repos } = setup();
    const m = repos.meetings.create({ title: "m" });
    const gen = repos.minutesRuns.start({ meetingId: m.id, lang: "en" });
    expect(gen.run).toMatchObject({ kind: "generate", overwrite: false });
    const tr = repos.minutesRuns.start({
      meetingId: m.id,
      lang: "vi",
      kind: "translate",
      overwrite: true,
    });
    expect(tr.run).toMatchObject({ kind: "translate", overwrite: true, lang: "vi" });
    const again = repos.minutesRuns.start({ meetingId: m.id, lang: "vi", kind: "generate" });
    expect(again.created).toBe(false);
    expect(again.run.kind).toBe("translate");
  });
});
