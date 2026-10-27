import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GhostLineFilter, Segmenter, fakeResult, type RawSegment } from "../src";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function pair(sourceLang: string) {
  const ghostFilter = new GhostLineFilter({ sourceLang });
  const segments: RawSegment[] = [];
  const make = (channel: 0 | 1) =>
    new Segmenter({ channel, ghostFilter, onSegment: (s) => segments.push(s) });
  return { mic: make(0), tab: make(1), segments };
}

const ENGLISH = "so each sheet has the same set of competitors listed.";

describe("ghost mic line", () => {
  it("drops a lone CJK syllable on a quiet mic while the tab speaks English (auto)", () => {
    const { mic, tab, segments } = pair("auto");
    tab.onFinal(fakeResult(1, ENGLISH, 168_000, 175_000));
    mic.onFinal(fakeResult(0, "嗯。", 170_680, 177_784));
    mic.flush();
    vi.advanceTimersByTime(5000);
    expect(segments.map((s) => s.channel)).toEqual([1]);
  });

  it("drops it for a fixed English source without needing the other channel", () => {
    const { mic, segments } = pair("en");
    mic.onFinal(fakeResult(0, "嗯。", 1000, 2000));
    mic.flush();
    expect(segments).toHaveLength(0);
  });

  it("keeps short real words in Latin scripts and Vietnamese", () => {
    const { mic, tab, segments } = pair("auto");
    tab.onFinal(fakeResult(1, ENGLISH, 0, 5000));
    for (const [i, word] of ["yes", "ok", "ừ", "vâng", "ạ"].entries()) {
      mic.onFinal(fakeResult(0, word, 30_000 * (i + 1), 30_000 * (i + 1) + 800));
      mic.flush();
    }
    expect(segments.filter((s) => s.channel === 0)).toHaveLength(5);
  });

  it("keeps CJK text when the other channel is not Latin / absent (auto)", () => {
    const { mic, segments } = pair("auto");
    mic.onFinal(fakeResult(0, "嗯。", 1000, 2000));
    mic.flush();
    expect(segments).toHaveLength(1);
  });

  it("keeps CJK text longer than the limit and CJK after recent mic speech", () => {
    const { mic, segments } = pair("en");
    mic.onFinal(fakeResult(0, "我们开始吧。", 0, 2000));
    mic.flush();
    mic.onFinal(fakeResult(0, "好。", 5000, 5500));
    mic.flush();
    expect(segments.map((s) => s.text)).toEqual(["我们开始吧。", "好。"]);
  });

  it("does nothing when the meeting is in a CJK language", () => {
    const { mic, segments } = pair("zh");
    mic.onFinal(fakeResult(0, "嗯。", 1000, 2000));
    mic.flush();
    expect(segments).toHaveLength(1);
  });
});
