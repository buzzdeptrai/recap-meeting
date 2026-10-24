import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Segmenter, fakeResult, type RawSegment } from "../src";
import { DEFAULT_SEGMENTER_CONFIG } from "../src/segmenter/config";
import { decideCut } from "../src/segmenter/decide";
import { isDependentWord } from "../src/segmenter/dependent-words";
import { tokenize } from "../src/segmenter/rules";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("isDependentWord", () => {
  it.each([
    "the",
    "The",
    "of",
    "and",
    "if",
    "is",
    "This",
    "don't",
    "DON’T",
    "that's",
    "và",
    "hoặc",
    "của",
    "để",
    "trong",
    "là",
    "Nếu",
    "các",
    "những",
    "một",
  ])("%s is dependent", (word) => expect(isDependentWord(word)).toBe(true));

  it.each(["patients", "inflammation", "the,", "and.", "bệnh", "nhân", "kế", "hoạch", "UK.", ""])(
    "%j is not dependent",
    (word) => expect(isDependentWord(word)).toBe(false),
  );
});

describe("decideCut", () => {
  const decide = (text: string, speechMs = 1000) =>
    decideCut(tokenize(text), speechMs, DEFAULT_SEGMENTER_CONFIG);

  it("cuts at a sentence end in the middle of the pending words", () => {
    expect(decide("progressive airways remodeling. And the damage")).toEqual({
      kind: "cut",
      end: 3,
      reason: "sentence",
    });
  });

  it("waits briefly on a trailing sentence mark", () => {
    expect(decide("it was a good day.")).toEqual({
      kind: "wait",
      delayMs: 250,
      reason: "sentence",
    });
  });

  it("does not treat abbreviations or tiny prefixes as sentence ends", () => {
    expect(decide("so Dr. Smith said hello to everyone").kind).not.toBe("cut");
    expect(decide("Yes. We should go now")).not.toMatchObject({ kind: "cut" });
  });

  it("uses a longer silence for short chunks", () => {
    expect(decide("one two three four five")).toMatchObject({ delayMs: 1000 });
    expect(decide("alpha beta gamma delta epsilon zeta eta theta iota kappa")).toMatchObject({
      kind: "wait",
      delayMs: 600,
    });
  });

  it("never cuts on a dependent word below the safety caps", () => {
    const eighteenAndThe = `${Array.from({ length: 17 }, (_, i) => `w${i}`).join(" ")} the`;
    expect(decide(eighteenAndThe)).toEqual({ kind: "none" });
    expect(decide("w1 w2 w3 w4 w5 w6 the", 7_000)).toEqual({ kind: "none" });
  });

  it("cuts at the next safe point once speech exceeds 6 s", () => {
    expect(decide("w1 w2 w3 w4 w5 w6", 6_000)).toMatchObject({ kind: "cut", reason: "hard_cap" });
  });

  it("allows a dependent-word cut beyond the safety caps", () => {
    expect(decide("w1 w2 w3 w4 w5 w6 the", 8_000)).toMatchObject({ kind: "cut" });
    const long = `${Array.from({ length: 27 }, (_, i) => `w${i}`).join(" ")} the`;
    expect(decide(long)).toMatchObject({ kind: "cut", reason: "hard_cap" });
  });
});

/** Word-by-word interim updates (300 ms apart) followed by an is_final, like Deepgram. */
function replay(chunks: readonly string[]): { segments: RawSegment[]; durationMs: number } {
  const segments: RawSegment[] = [];
  const segmenter = new Segmenter({ channel: 0, onSegment: (segment) => segments.push(segment) });
  const stepMs = 300;
  let clock = 0;
  for (const chunk of chunks) {
    const tokens = tokenize(chunk);
    const start = clock;
    for (let i = 1; i <= tokens.length; i++) {
      vi.advanceTimersByTime(stepMs);
      clock += stepMs;
      segmenter.onInterim(fakeResult(0, tokens.slice(0, i).join(" "), start, clock));
    }
    vi.advanceTimersByTime(stepMs);
    clock += stepMs;
    segmenter.onFinal(fakeResult(0, chunk, start, clock, "en"));
    vi.advanceTimersByTime(stepMs);
    clock += stepMs;
  }
  segmenter.flush();
  return { segments, durationMs: clock };
}

const ENGLISH_CHUNKS = [
  "Therefore, more courses of steroids, but it also leads to lung function",
  "decline over time through progressive airways remodeling. And the damage from the",
  "steroids that happens to our patients if you don't",
  "control TG inflammation or that's needed to control TG inflammation,",
  "which can't be underestimated. And as we've shown in the",
  "previous talk, this is again data from the UK. This is",
  "about half a million patients.",
];

const VIETNAMESE_CHUNKS = [
  "Chúng ta đã thống nhất kế hoạch triển khai cho",
  "quý ba và ngân sách của",
  "phòng kỹ thuật sẽ được duyệt vào tuần sau. Tuy nhiên chúng tôi cần",
  "thêm thời gian để kiểm tra các",
  "hệ thống thanh toán trước khi phát hành.",
];

describe.each([
  ["English", ENGLISH_CHUNKS],
  ["Vietnamese", VIETNAMESE_CHUNKS],
])("replay of a recorded %s run", (_name, chunks) => {
  it("never ends a segment on a dependent word", () => {
    const { segments } = replay(chunks);
    expect(segments.length).toBeGreaterThan(1);
    const offenders = segments.filter((s) => isDependentWord(s.text.split(" ").at(-1)));
    expect(offenders.map((s) => s.text)).toEqual([]);
  });

  it("keeps every segment below the safety cap and preserves all words", () => {
    const { segments } = replay(chunks);
    const max = DEFAULT_SEGMENTER_CONFIG.safetyMaxWords;
    expect(Math.max(...segments.map((s) => tokenize(s.text).length))).toBeLessThanOrEqual(max);
    expect(segments.map((s) => s.text).join(" ")).toBe(chunks.join(" "));
  });

  it("cuts at every mid-text sentence boundary", () => {
    const { segments } = replay(chunks);
    const text = chunks.join(" ");
    const boundaries = text.match(/[.?!] (?=\S)/g)?.length ?? 0;
    const sentenceEnds = segments.filter((s) => /[.?!]$/.test(s.text)).length;
    expect(sentenceEnds).toBeGreaterThanOrEqual(boundaries);
  });
});

describe("English recording specifics", () => {
  it("splits at 'remodeling.' instead of cutting after 'damage from the'", () => {
    const { segments } = replay(ENGLISH_CHUNKS);
    const texts = segments.map((s) => s.text);
    expect(texts.some((t) => t.endsWith("airways remodeling."))).toBe(true);
    expect(texts.some((t) => t.endsWith("damage from the"))).toBe(false);
    expect(texts.some((t) => t.endsWith("if you don't"))).toBe(false);
  });
});
