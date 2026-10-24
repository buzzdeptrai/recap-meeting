import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

function seeded(count: number, stepMs = 1000) {
  const ctx = setup();
  const meetingId = ctx.repos.meetings.create({ title: "m" }).id;
  for (let seq = 0; seq < count; seq++) {
    const segment = ctx.repos.segments.insert({
      meetingId,
      seq,
      channel: 0,
      lang: "vi",
      startMs: seq * stepMs,
      endMs: seq * stepMs + stepMs - 100,
      text: `câu số ${seq}`,
    });
    ctx.repos.translations.upsert({
      segmentId: segment.id,
      lang: "en",
      text: `sentence ${seq}`,
      provider: "t",
      latencyMs: 1,
    });
  }
  return { ...ctx, meetingId };
}

const seqs = (page: { segments: { seq: number }[] }) => page.segments.map((s) => s.seq);

describe("segments.page", () => {
  it("returns an empty page for an empty meeting", () => {
    const { repos, meetingId } = seeded(0);
    expect(repos.segments.page(meetingId)).toEqual({
      segments: [],
      nextCursor: null,
      prevCursor: null,
      total: 0,
    });
    expect(repos.segments.page(meetingId, { dir: "backward" }).segments).toEqual([]);
  });

  it("pages forward with an inclusive cursor and reports the next one", () => {
    const { repos, meetingId } = seeded(10);
    const first = repos.segments.page(meetingId, { limit: 4 });
    expect(seqs(first)).toEqual([0, 1, 2, 3]);
    expect(first).toMatchObject({ nextCursor: 4, prevCursor: null, total: 10 });
    const second = repos.segments.page(meetingId, { from: first.nextCursor ?? 0, limit: 4 });
    expect(seqs(second)).toEqual([4, 5, 6, 7]);
    expect(second.prevCursor).toBe(4);
    const last = repos.segments.page(meetingId, { from: 8, limit: 4 });
    expect(seqs(last)).toEqual([8, 9]);
    expect(last.nextCursor).toBeNull();
  });

  it("pages backward from the end, ascending, with an exclusive cursor", () => {
    const { repos, meetingId } = seeded(10);
    const tail = repos.segments.page(meetingId, { dir: "backward", limit: 4 });
    expect(seqs(tail)).toEqual([6, 7, 8, 9]);
    expect(tail).toMatchObject({ nextCursor: null, prevCursor: 6 });
    const before = repos.segments.page(meetingId, { dir: "backward", from: 6, limit: 4 });
    expect(seqs(before)).toEqual([2, 3, 4, 5]);
    expect(before.nextCursor).toBe(6);
    const head = repos.segments.page(meetingId, { dir: "backward", from: 2, limit: 4 });
    expect(seqs(head)).toEqual([0, 1]);
    expect(head.prevCursor).toBeNull();
    expect(repos.segments.page(meetingId, { dir: "backward", from: 0 }).segments).toEqual([]);
  });

  it("handles gaps in seq and a cursor past the end", () => {
    const { repos, meetingId } = seeded(3);
    repos.segments.insert({
      meetingId,
      seq: 9999,
      channel: 1,
      lang: null,
      startMs: 5000,
      endMs: 5100,
      text: "late",
    });
    const page = repos.segments.page(meetingId, { from: 1, limit: 2 });
    expect(seqs(page)).toEqual([1, 2]);
    expect(page.nextCursor).toBe(9999);
    expect(repos.segments.page(meetingId, { from: 10_000 }).segments).toEqual([]);
  });

  it("clamps limit to 1..500 and defaults to 200", () => {
    const { repos, meetingId } = seeded(600);
    expect(repos.segments.page(meetingId).segments).toHaveLength(200);
    expect(repos.segments.page(meetingId, { limit: 100_000 }).segments).toHaveLength(500);
    expect(repos.segments.page(meetingId, { limit: 0 }).segments).toHaveLength(200);
    expect(repos.segments.page(meetingId, { limit: -5 }).segments).toHaveLength(1);
  });

  it("never mixes meetings", () => {
    const { repos, meetingId } = seeded(3);
    const other = repos.meetings.create({ title: "o" }).id;
    repos.segments.insert({
      meetingId: other,
      seq: 0,
      channel: 0,
      lang: null,
      startMs: 0,
      endMs: 1,
      text: "x",
    });
    expect(repos.segments.page(meetingId).total).toBe(3);
    expect(repos.segments.page(other).segments).toHaveLength(1);
  });
});

describe("translations.listBySeqRange", () => {
  it("returns translations of the page's segments only", () => {
    const { repos, meetingId } = seeded(10);
    const page = repos.segments.page(meetingId, { from: 3, limit: 3 });
    const last = page.segments.at(-1)?.seq ?? 0;
    const translations = repos.translations.listBySeqRange(meetingId, 3, last);
    expect(translations.map((t) => t.text)).toEqual(["sentence 3", "sentence 4", "sentence 5"]);
    expect(repos.translations.listBySeqRange(meetingId, 50, 60)).toEqual([]);
  });
});

describe("segments.locate", () => {
  it("finds the segment spanning the time and leaves half a page before it", () => {
    const { repos, meetingId } = seeded(100);
    const hit = repos.segments.locate(meetingId, { atMs: 50_500, limit: 20 });
    expect(hit).toMatchObject({ seq: 50, startMs: 50_000, from: 40 });
    const page = repos.segments.page(meetingId, { from: hit?.from, limit: 20 });
    expect(seqs(page)).toContain(50);
  });

  it("picks the nearest segment in a gap and clamps to the edges", () => {
    const { repos, meetingId } = seeded(100);
    // 10_960 is in the 100 ms gap after seq 10 (ends 10_900): closer to seq 11 (starts 11_000).
    expect(repos.segments.locate(meetingId, { atMs: 10_960 })?.seq).toBe(11);
    expect(repos.segments.locate(meetingId, { atMs: 10_920 })?.seq).toBe(10);
    expect(repos.segments.locate(meetingId, { atMs: 0, limit: 20 })).toMatchObject({
      seq: 0,
      from: 0,
    });
    expect(repos.segments.locate(meetingId, { atMs: 5_000_000 })?.seq).toBe(99);
    expect(repos.segments.locate(meetingId, { atMs: 3000, limit: 20 })?.from).toBe(0);
  });

  it("locates by seq, and returns undefined for an empty meeting or missing seq", () => {
    const { repos, meetingId } = seeded(5);
    expect(repos.segments.locate(meetingId, { seq: 3 })?.seq).toBe(3);
    expect(repos.segments.locate(meetingId, { seq: 77 })).toBeUndefined();
    const empty = repos.meetings.create({ title: "e" }).id;
    expect(repos.segments.locate(empty, { atMs: 1000 })).toBeUndefined();
  });
});

describe("segments.stats / anchorAt", () => {
  it("counts segments, words and translated segments over the whole meeting", () => {
    const { repos, meetingId } = seeded(4);
    expect(repos.segments.stats(meetingId)).toEqual({ segments: 4, words: 12, translated: 4 });
    expect(repos.segments.stats(repos.meetings.create({ title: "e" }).id)).toEqual({
      segments: 0,
      words: 0,
      translated: 0,
    });
  });

  it("anchors a mark on the last segment that started before it", () => {
    const { repos, meetingId } = seeded(10);
    expect(repos.segments.anchorAt(meetingId, 3500)).toMatchObject({ seq: 3, text: "câu số 3" });
    expect(repos.segments.anchorAt(meetingId, -1)).toBeUndefined();
  });
});

describe("searchTranscript", () => {
  it("matches diacritics-insensitively in text and translation, one hit per segment", () => {
    const { repos, meetingId } = seeded(30);
    const byText = repos.segments.search(meetingId, "cau so 2");
    expect(byText.hits.map((h) => h.seq)).toEqual([2, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
    expect(byText.hits[0]).toMatchObject({ source: "text", startMs: 2000 });
    expect(byText.hits[0]?.snippet).toBe("<mark>câu</mark> <mark>số</mark> <mark>2</mark>");
    const byTranslation = repos.segments.search(meetingId, "sentence 7");
    expect(byTranslation.hits).toHaveLength(1);
    expect(byTranslation.hits[0]).toMatchObject({ seq: 7, source: "translation" });
    expect(byTranslation.hits[0]?.snippet).toContain("<mark>sentence</mark>");
  });

  it("limits, flags truncation, sanitizes operators and scopes to the meeting", () => {
    const { repos, meetingId } = seeded(30);
    const limited = repos.segments.search(meetingId, "câu", 5);
    expect(limited.hits).toHaveLength(5);
    expect(limited.truncated).toBe(true);
    expect(repos.segments.search(meetingId, '"" OR * -- :').hits).toEqual([]);
    expect(repos.segments.search(meetingId, "   ")).toEqual({
      hits: [],
      truncated: false,
      terms: [],
    });
    const other = repos.meetings.create({ title: "o" }).id;
    expect(repos.segments.search(other, "câu").hits).toEqual([]);
  });

  it("escapes HTML in snippets and sees segments added later", () => {
    const { repos, meetingId } = seeded(1);
    repos.segments.insert({
      meetingId,
      seq: 1,
      channel: 0,
      lang: "en",
      startMs: 1,
      endMs: 2,
      text: "a <b>bold</b> & quick move",
    });
    const hit = repos.segments.search(meetingId, "bold").hits[0];
    expect(hit?.snippet).toBe("a &lt;b&gt;<mark>bold</mark>&lt;/b&gt; &amp; quick move");
  });
});
