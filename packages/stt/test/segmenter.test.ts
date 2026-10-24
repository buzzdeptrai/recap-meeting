import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Segmenter, fakeResult, splitLongText, type RawSegment } from "../src";

const words = (n: number, prefix = "w") =>
  Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`).join(" ");

function setup(options: Partial<ConstructorParameters<typeof Segmenter>[0]> = {}) {
  const segments: RawSegment[] = [];
  const interims: string[] = [];
  const segmenter = new Segmenter({
    channel: 0,
    onSegment: (segment) => segments.push(segment),
    onInterim: (text) => interims.push(text),
    ...options,
  });
  return { segmenter, segments, interims };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("silence cut", () => {
  it("cuts a short chunk (5-9 words) after 1000 ms without a new interim", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(0, words(5), 1000, 2000));
    vi.advanceTimersByTime(999);
    expect(segments).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(segments).toMatchObject([
      { text: words(5), reason: "silence", startMs: 1000, endMs: 2000 },
    ]);
  });

  it("restarts the timer on every new interim", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(0, words(5)));
    vi.advanceTimersByTime(900);
    segmenter.onInterim(fakeResult(0, words(6)));
    vi.advanceTimersByTime(900);
    expect(segments).toHaveLength(0);
    vi.advanceTimersByTime(100);
    expect(segments).toMatchObject([{ text: words(6) }]);
  });

  it("cuts a long chunk (10+ words, no boundary) after 600 ms", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(0, words(10)));
    vi.advanceTimersByTime(599);
    expect(segments).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(segments).toMatchObject([{ reason: "silence" }]);
  });

  it("does not cut fewer than 5 words", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(0, words(4)));
    vi.advanceTimersByTime(5000);
    expect(segments).toHaveLength(0);
  });
});

describe("semantic cut", () => {
  it("cuts at 10+ words when punctuation sits in the last 40%", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(0, "we should ship the release next week, and then review"));
    expect(segments).toMatchObject([{ reason: "semantic" }]);
  });

  it("cuts on an English conjunction in the tail", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(
      fakeResult(0, "the budget was approved last quarter but nobody told finance"),
    );
    expect(segments).toMatchObject([{ reason: "semantic" }]);
  });

  it("cuts on a Vietnamese two-word connective in the tail", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(
      fakeResult(0, "chúng ta đã thống nhất kế hoạch tuần trước tuy nhiên ngân sách chưa duyệt"),
    );
    expect(segments).toMatchObject([{ reason: "semantic" }]);
  });

  it("does not cut below 10 words even with punctuation", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(0, "well, we should ship it now"));
    expect(segments).toHaveLength(0);
  });
});

describe("hard cap", () => {
  it("cuts at 18 words", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(0, words(17)));
    expect(segments).toHaveLength(0);
    segmenter.onInterim(fakeResult(0, words(18)));
    expect(segments).toMatchObject([{ reason: "hard_cap" }]);
  });

  it("cuts at 200 characters", () => {
    const { segmenter, segments } = setup();
    const longWords = Array.from({ length: 12 }, () => "x".repeat(20)).join(" ");
    segmenter.onInterim(fakeResult(0, longWords));
    expect(segments).toMatchObject([{ reason: "hard_cap" }]);
  });
});

describe("finals", () => {
  it("emits only the remainder after an early cut, holding it when short", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(0, words(18)));
    segmenter.onFinal(fakeResult(0, words(20)));
    expect(segments).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(segments.map((s) => [s.text, s.reason])).toEqual([
      [words(18), "hard_cap"],
      ["w19 w20", "buffer_flush"],
    ]);
  });

  it("emits a normal final immediately", () => {
    const { segmenter, segments } = setup();
    segmenter.onFinal(fakeResult(0, "this is a complete sentence.", 0, 2000, "en"));
    expect(segments).toMatchObject([{ reason: "final", lang: "en", startMs: 0, endMs: 2000 }]);
  });

  it("holds a short final and merges it into the next one", () => {
    const { segmenter, segments, interims } = setup();
    segmenter.onFinal(fakeResult(0, "yes sure", 0, 500));
    expect(segments).toHaveLength(0);
    expect(interims.at(-1)).toBe("yes sure");
    segmenter.onFinal(fakeResult(0, "let us move on to the agenda", 600, 2000));
    expect(segments).toMatchObject([
      { text: "yes sure let us move on to the agenda", startMs: 0, endMs: 2000 },
    ]);
    vi.advanceTimersByTime(10_000);
    expect(segments).toHaveLength(1);
  });

  it("flushes a held short final after 3 s", () => {
    const { segmenter, segments } = setup();
    segmenter.onFinal(fakeResult(0, "okay thanks"));
    vi.advanceTimersByTime(2999);
    expect(segments).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(segments).toMatchObject([{ text: "okay thanks", reason: "buffer_flush" }]);
  });

  it("splits a final over 200 chars at sentence boundaries", () => {
    const { segmenter, segments } = setup();
    const sentence = `${"word ".repeat(15).trim()}.`; // 75 chars
    segmenter.onFinal(fakeResult(0, [sentence, sentence, sentence, sentence].join(" "), 0, 8000));
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.every((s) => s.text.length <= 200)).toBe(true);
    expect(segments[0]?.startMs).toBe(0);
    expect(segments.at(-1)?.endMs).toBe(8000);
  });
});

describe("flush / dispose", () => {
  it("flush emits uncut interim words and the held buffer", () => {
    const { segmenter, segments } = setup();
    segmenter.onFinal(fakeResult(0, "short one"));
    segmenter.onInterim(fakeResult(0, "tail words here"));
    segmenter.flush();
    expect(segments.map((s) => s.reason)).toEqual(["flush"]);
    expect(segments[0]?.text).toBe("short one tail words here");
    vi.advanceTimersByTime(10_000);
    expect(segments).toHaveLength(1);
  });

  it("dispose cancels timers", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(0, words(6)));
    segmenter.dispose();
    vi.advanceTimersByTime(5000);
    expect(segments).toHaveLength(0);
  });
});

describe("variant correction", () => {
  it("replaces ASR variants longest-first with unicode-aware boundaries", () => {
    const variants = [
      { variant: "deep gram", canonical: "Deepgram" },
      { variant: "deep gram api", canonical: "Deepgram API" },
      { variant: "dự án", canonical: "du an" },
    ];
    const { segmenter, segments } = setup({ variants: () => variants });
    segmenter.onFinal(fakeResult(0, "we use the deep gram api for dự án and dự ánh stuff"));
    expect(segments[0]?.text).toBe("we use the Deepgram API for du an and dự ánh stuff");
  });
});

describe("splitLongText", () => {
  it("falls back to clause boundaries when there is no sentence punctuation", () => {
    const clause = "a".repeat(80);
    const parts = splitLongText(`${clause}, ${clause}, ${clause}`, 200);
    expect(parts.length).toBe(2);
    expect(parts.every((p) => p.length <= 200)).toBe(true);
  });
});
