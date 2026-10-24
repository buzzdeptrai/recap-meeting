import type { Mark, Segment } from "@recap/core";
import { describe, expect, it } from "vitest";
import {
  anchoredScrollTop,
  buildVirtualRows,
  EDGE_ROW_PX,
  estimatedStart,
  estimateRowHeight,
  indexOfKey,
  indexOfSeq,
  neighbourSegmentIndex,
  pickAnchor,
  type InterimLines,
  type VirtualRow,
} from "./virtual-rows";

const seg = (n: number, text = `t${n}`): Segment => ({
  id: `s${n}`,
  seq: n,
  channel: 0,
  lang: "vi",
  startMs: n * 10_000,
  endMs: n * 10_000 + 5_000,
  text,
});
const topic: Mark = { id: "m1", kind: "topic", atMs: 10_000, label: "Giá" };
const none: InterimLines = { 0: null, 1: null };
const keys = (rows: VirtualRow[]) => rows.map((r) => r.key);

describe("buildVirtualRows", () => {
  it("adds edge loaders only on sides that have more", () => {
    const rows = buildVirtualRows({
      segments: [seg(1), seg(2)],
      marks: [],
      edges: { hasPrev: true, hasNext: true },
      interim: none,
      showInterim: true,
    });
    expect(keys(rows)).toEqual(["edge-top", "s1", "s2", "edge-bottom"]);
  });

  it("keeps stable keys for dividers and segments, and puts interim lines last at the tail", () => {
    const interim: InterimLines = { 0: null, 1: { text: "đang nói", startMs: 99, endMs: 100 } };
    const rows = buildVirtualRows({
      segments: [seg(0), seg(1)],
      marks: [topic],
      edges: { hasPrev: false, hasNext: false },
      interim,
      showInterim: true,
    });
    expect(keys(rows)).toEqual(["s0", "topic-m1", "s1", "interim-1"]);
  });

  it("hides interim lines when the window is not the live tail or interim is off", () => {
    const interim: InterimLines = { 0: { text: "x", startMs: 1, endMs: 2 }, 1: null };
    const base = { segments: [seg(0)], marks: [], interim };
    expect(
      keys(
        buildVirtualRows({ ...base, edges: { hasPrev: false, hasNext: true }, showInterim: true }),
      ),
    ).toEqual(["s0", "edge-bottom"]);
    expect(
      keys(
        buildVirtualRows({
          ...base,
          edges: { hasPrev: false, hasNext: false },
          showInterim: false,
        }),
      ),
    ).toEqual(["s0"]);
  });
});

describe("row lookups", () => {
  const rows = buildVirtualRows({
    segments: [seg(3), seg(4), seg(5)],
    marks: [{ ...topic, atMs: 40_000 }],
    edges: { hasPrev: true, hasNext: false },
    interim: none,
    showInterim: false,
  });

  it("finds rows by key and seq", () => {
    expect(indexOfKey(rows, "s4")).toBe(3);
    expect(indexOfSeq(rows, 5)).toBe(4);
    expect(indexOfSeq(rows, 99)).toBe(-1);
  });

  it("steps between segment rows, skipping dividers and edges", () => {
    expect(neighbourSegmentIndex(rows, 1, 1)).toBe(3); // s3 -> over the divider -> s4
    expect(neighbourSegmentIndex(rows, 3, -1)).toBe(1);
    expect(neighbourSegmentIndex(rows, 1, -1)).toBe(-1);
    expect(neighbourSegmentIndex(rows, 4, 1)).toBe(-1);
  });
});

describe("estimateRowHeight", () => {
  const ctx = { view: "both" as const, width: 1000, translations: {} };
  const row = (text: string): VirtualRow => ({ type: "segment", segment: seg(1, text), key: "s1" });

  it("grows with text length and adds the translation in both view", () => {
    const short = estimateRowHeight(row("ngắn"), ctx);
    const long = estimateRowHeight(row("x".repeat(300)), ctx);
    expect(long).toBeGreaterThan(short + 60);
    const withTranslation = estimateRowHeight(row("ngắn"), {
      ...ctx,
      translations: { s1: { lang: "en", text: "short", provider: "p" } },
    });
    expect(withTranslation).toBeGreaterThan(short);
    expect(
      estimateRowHeight(row("ngắn"), {
        ...ctx,
        view: "source",
        translations: { s1: { lang: "en", text: "short", provider: "p" } },
      }),
    ).toBe(short);
  });

  it("wraps more on a narrow screen and has fixed heights for edges and dividers", () => {
    const text = "x".repeat(200);
    expect(estimateRowHeight(row(text), { ...ctx, width: 380 })).toBeGreaterThan(
      estimateRowHeight(row(text), ctx),
    );
    expect(estimateRowHeight({ type: "edge", side: "top", key: "e" }, ctx)).toBe(EDGE_ROW_PX);
    expect(estimateRowHeight(undefined, ctx)).toBeGreaterThan(0);
  });

  it("sums estimates up to an index", () => {
    const rows = [row("a"), row("b"), row("c")];
    const one = estimateRowHeight(rows[0], ctx);
    expect(estimatedStart(rows, 2, ctx)).toBeCloseTo(one * 2);
    expect(estimatedStart(rows, 0, ctx)).toBe(0);
  });
});

describe("scroll anchoring", () => {
  const before = [
    { key: "a", start: 0, size: 100 },
    { key: "b", start: 100, size: 80 },
    { key: "c", start: 180, size: 120 },
  ];

  it("anchors on the first row reaching into the viewport and remembers its offset", () => {
    expect(pickAnchor(before, 130)).toEqual({ key: "b", offsetFromTop: -30 });
    expect(pickAnchor(before, 0)).toEqual({ key: "a", offsetFromTop: 0 });
    expect(pickAnchor(before, 10_000)).toBeNull();
  });

  it("restores the same on-screen position after rows are prepended", () => {
    const anchor = pickAnchor(before, 130);
    // 500px of older rows were inserted above: row b now starts at 600.
    expect(anchoredScrollTop(anchor!, 600)).toBe(630);
  });

  it("never scrolls above the top", () => {
    expect(anchoredScrollTop({ key: "x", offsetFromTop: 50 }, 10)).toBe(0);
  });
});
