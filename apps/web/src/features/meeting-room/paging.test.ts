import type { Segment } from "@recap/core";
import { describe, expect, it } from "vitest";
import {
  extendWindow,
  isAtHead,
  isAtTail,
  isCurrentPage,
  mergeSegments,
  mergeTranslations,
} from "./paging";

const seg = (seq: number, text = `t${seq}`): Segment => ({
  id: `s${seq}`,
  seq,
  channel: 0,
  lang: "vi",
  startMs: seq * 1000,
  endMs: seq * 1000 + 500,
  text,
});
const seqs = (list: Segment[]) => list.map((s) => s.seq);

describe("mergeSegments", () => {
  it("appends and prepends adjacent runs", () => {
    expect(seqs(mergeSegments([seg(3), seg(4)], [seg(5), seg(6)]))).toEqual([3, 4, 5, 6]);
    expect(seqs(mergeSegments([seg(3), seg(4)], [seg(1), seg(2)]))).toEqual([1, 2, 3, 4]);
  });

  it("de-duplicates overlapping runs, the incoming copy winning", () => {
    const merged = mergeSegments([seg(1), seg(2, "old"), seg(3)], [seg(2, "new"), seg(3), seg(4)]);
    expect(seqs(merged)).toEqual([1, 2, 3, 4]);
    expect(merged[1]?.text).toBe("new");
  });

  it("handles empty sides and returns the same array when nothing is added", () => {
    const current = [seg(1)];
    expect(mergeSegments(current, [])).toBe(current);
    const incoming = [seg(1)];
    expect(mergeSegments([], incoming)).toBe(incoming);
  });

  it("orders interleaved runs by seq", () => {
    expect(seqs(mergeSegments([seg(1), seg(5)], [seg(2), seg(3)]))).toEqual([1, 2, 3, 5]);
  });
});

describe("window cursors", () => {
  it("knows its edges", () => {
    expect(isAtTail({ prevCursor: 5, nextCursor: null })).toBe(true);
    expect(isAtHead({ prevCursor: 5, nextCursor: null })).toBe(false);
  });

  it("accepts a page only for the cursor the window is waiting on", () => {
    const window = { prevCursor: 10, nextCursor: 30 };
    expect(isCurrentPage(window, "forward", 30)).toBe(true);
    expect(isCurrentPage(window, "backward", 10)).toBe(true);
    expect(isCurrentPage(window, "forward", 10)).toBe(false);
    expect(isCurrentPage(window, "forward", null)).toBe(false);
    expect(isCurrentPage({ prevCursor: 10, nextCursor: null }, "forward", 30)).toBe(false);
  });

  it("extends only the side that was loaded", () => {
    const window = { prevCursor: 10, nextCursor: 30 };
    expect(extendWindow(window, "forward", { prevCursor: 30, nextCursor: 50 })).toEqual({
      prevCursor: 10,
      nextCursor: 50,
    });
    expect(extendWindow(window, "backward", { prevCursor: null, nextCursor: 10 })).toEqual({
      prevCursor: null,
      nextCursor: 30,
    });
  });
});

describe("mergeTranslations", () => {
  const view = (t: { lang: string; text: string; provider: string }) => ({ ...t });
  it("keeps translations that arrived live", () => {
    const merged = mergeTranslations(
      { s1: { lang: "vi", text: "live", provider: "p" } },
      [
        { segmentId: "s1", lang: "vi", text: "db", provider: "p", latencyMs: 1 },
        { segmentId: "s2", lang: "vi", text: "db2", provider: "p", latencyMs: 1 },
      ],
      view,
    );
    expect(merged["s1"]?.text).toBe("live");
    expect(merged["s2"]?.text).toBe("db2");
  });
});
