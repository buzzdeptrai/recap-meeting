import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SEGMENTER_CONFIG,
  Segmenter,
  VI_SEGMENTER_CONFIG,
  fakeResult,
  segmenterConfigForLanguage,
  type RawSegment,
} from "../src";
import { decideCut } from "../src/segmenter/decide";
import { isDependentWord } from "../src/segmenter/dependent-words";
import { tokenize } from "../src/segmenter/rules";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const VI = VI_SEGMENTER_CONFIG;
const decideVi = (text: string, speechMs: number) => decideCut(tokenize(text), speechMs, VI);

describe("segmenterConfigForLanguage", () => {
  it("picks the Vietnamese profile for vi, multi, detect and auto, English otherwise", () => {
    for (const language of ["vi", "multi", "detect", "auto"]) {
      expect(segmenterConfigForLanguage(language)).toBe(VI);
    }
    expect(segmenterConfigForLanguage("en")).toBe(DEFAULT_SEGMENTER_CONFIG);
  });

  it("keeps the config invariants the English profile relies on", () => {
    for (const c of [DEFAULT_SEGMENTER_CONFIG, VI]) {
      expect(c.silenceMs).toBeLessThan(c.silenceShortMs);
      expect(c.sentenceMinWords).toBeLessThan(c.minWords);
      expect(c.minWords).toBeLessThan(c.longChunkWords);
      expect(c.longChunkWords).toBeLessThanOrEqual(c.semanticMinWords);
      expect(c.semanticMinWords).toBeLessThan(c.hardMaxWords);
      expect(c.hardMaxWords).toBeLessThan(c.safetyMaxWords);
      expect(c.hardMaxChars).toBeLessThan(c.safetyMaxChars);
      expect(c.maxSpeechMs).toBeLessThan(c.safetyMaxSpeechMs);
      expect(c.silenceMinSpeechMs).toBeLessThan(c.maxSpeechMs);
    }
    expect(DEFAULT_SEGMENTER_CONFIG.silenceMinSpeechMs).toBe(0);
  });
});

describe("Vietnamese dependent words", () => {
  it.each(["nội", "cái", "con", "chiếc", "vẫn", "cũng", "chỉ", "vừa", "đều", "hơi", "khá"])(
    "%s cannot end a chunk",
    (word) => expect(isDependentWord(word)).toBe(true),
  );

  it.each(["rồi", "nhé", "ạ", "đấy", "thôi", "nữa", "không", "chưa", "lại", "quá", "dung"])(
    "%s may end a chunk",
    (word) => expect(isDependentWord(word)).toBe(false),
  );

  it("is still released by a trailing comma", () => {
    expect(isDependentWord("cái,")).toBe(false);
  });
});

describe("decideCut with the Vietnamese profile (real mis-cuts)", () => {
  it("does not cut 'đầu tiên đó là mình chia cái dạng nội' before 'dung'", () => {
    expect(decideVi("đầu tiên đó là mình chia cái dạng nội", 2500)).toEqual({ kind: "none" });
  });

  it("does not cut after 'những cái' even when the silence gate is open", () => {
    const text =
      "tất nhiên là mình có đọc thêm cả những cái và còn nhiều thứ khác nữa là những cái";
    expect(decideVi(text, 6000)).toEqual({ kind: "none" });
  });

  it("does not start our own silence timer before the speech gate is reached", () => {
    const text = "mình quan sát bản thân mình quan sát năng lượng của mình rồi viết xuống";
    expect(tokenize(text).length).toBeLessThan(VI.longChunkWords);
    expect(decideVi(text, 2200)).toEqual({ kind: "none" });
    const long = `${text} sau đó thử các cách khác nhau`;
    expect(tokenize(long).length).toBeGreaterThanOrEqual(VI.longChunkWords);
    expect(decideVi(long, 3000)).toEqual({ kind: "none" });
    expect(decideVi(long, 4200)).toEqual({
      kind: "wait",
      delayMs: VI.silenceMs,
      reason: "silence",
    });
  });

  it("still cuts at a sentence prefix, and at the hard cap on a safe word", () => {
    expect(decideVi("Chúng ta đã thống nhất kế hoạch. Còn phần ngân sách", 3000)).toMatchObject({
      kind: "cut",
      reason: "sentence",
    });
    const words = Array.from({ length: VI.hardMaxWords }, (_, i) => `từ${i}`).join(" ");
    expect(decideVi(words, 3000)).toEqual({
      kind: "cut",
      end: VI.hardMaxWords,
      reason: "hard_cap",
    });
  });

  it("lets the safety caps override the dependent-word guard", () => {
    const words = `${Array.from({ length: VI.safetyMaxWords - 1 }, (_, i) => `từ${i}`).join(" ")} cái`;
    expect(decideVi(words, 3000)).toMatchObject({ kind: "cut", reason: "hard_cap" });
    expect(decideVi("mình chia cái dạng nội", VI.safetyMaxSpeechMs)).toMatchObject({
      kind: "cut",
      reason: "hard_cap",
    });
  });
});

describe("silenceMinSpeechMs", () => {
  const text = "một hai ba bốn năm sáu bảy tám chín mười mười_một mười_hai";
  const cfg = (silenceMinSpeechMs: number) => ({
    ...DEFAULT_SEGMENTER_CONFIG,
    longChunkWords: 10,
    silenceMinSpeechMs,
  });

  it("is off by default: English still waits on silence", () => {
    expect(decideCut(tokenize(text), 500, DEFAULT_SEGMENTER_CONFIG)).toMatchObject({
      kind: "wait",
      reason: "silence",
    });
  });

  it("gates the silence wait on speech time when set", () => {
    expect(decideCut(tokenize(text), 3999, cfg(4000))).toEqual({ kind: "none" });
    expect(decideCut(tokenize(text), 4000, cfg(4000))).toMatchObject({ kind: "wait" });
  });
});

describe("Segmenter with the Vietnamese profile", () => {
  it("holds a short final ending on 'cái' and merges it with the next one", () => {
    const out: RawSegment[] = [];
    const segmenter = new Segmenter({
      channel: 1,
      config: VI,
      onSegment: (s) => out.push(s),
    });
    segmenter.onFinal(fakeResult(1, "tất nhiên là mình có đọc thêm cả những cái", 0, 3000));
    expect(out).toHaveLength(0);
    segmenter.onFinal(
      fakeResult(1, "chuyên gia về mảng này nữa thì mình rút ra được ba điểm.", 3000, 7000),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toBe(
      "tất nhiên là mình có đọc thêm cả những cái chuyên gia về mảng này nữa thì mình rút ra được ba điểm.",
    );
    segmenter.dispose();
  });
});
