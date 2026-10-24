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

const seg = (n: number, text = `t${n}`, channel: 0 | 1 = 0): Segment => ({
  id: `s${n}`,
  seq: n,
  channel,
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

describe("turn headers", () => {
  const build = (
    segments: Segment[],
    edges = { hasPrev: false, hasNext: false },
    marks = [topic],
  ) => buildVirtualRows({ segments, marks, edges, interim: none, showInterim: false });
  const headers = (rows: VirtualRow[]) =>
    rows.flatMap((r) => (r.type === "segment" ? [[r.key, r.showHeader]] : []));

  it("shows the header on the first row and when the channel changes, not on continuations", () => {
    const rows = build([seg(0), seg(1), seg(2, "x", 1), seg(3, "y", 1), seg(4)], undefined, []);
    expect(headers(rows)).toEqual([
      ["s0", true],
      ["s1", false],
      ["s2", true],
      ["s3", false],
      ["s4", true],
    ]);
  });

  it("shows the header after a long pause by the same speaker", () => {
    const late = { ...seg(2), startMs: 50_000, endMs: 52_000 };
    const rows = build([seg(1), late], undefined, []);
    expect(headers(rows)).toEqual([
      ["s1", true],
      ["s2", true],
    ]);
  });

  it("shows the header after a topic divider and on the first row of a loaded window", () => {
    // topic at 10_000: divider sits before s1 (startMs 10_000)
    const rows = build([seg(3), seg(4), seg(5)], { hasPrev: true, hasNext: true }, [
      { ...topic, atMs: 40_000 },
    ]);
    expect(headers(rows)).toEqual([
      ["s3", true], // predecessor is not loaded
      ["s4", true], // after the divider
      ["s5", false],
    ]);
  });

  it("a conclusion divider breaks the turn like a topic divider, so the next row shows its header", () => {
    const k: Mark = { id: "k1", kind: "conclusion", atMs: 20_000, label: null };
    const rows = build([seg(1), seg(2), seg(3)], undefined, [k]);
    expect(rows.map((r) => r.key)).toEqual(["s1", "conclusion-k1", "s2", "s3"]);
    expect(headers(rows)).toEqual([
      ["s1", true],
      ["s2", true], // same speaker, no pause: only the divider breaks the turn
      ["s3", false],
    ]);
  });

  it("gives interim lines a header unless they continue the previous line", () => {
    const interim: InterimLines = {
      0: { text: "đang nói", startMs: 40_000, endMs: 41_000 },
      1: null,
    };
    const rows = buildVirtualRows({
      segments: [seg(3)],
      marks: [],
      edges: { hasPrev: false, hasNext: false },
      interim,
      showInterim: true,
    });
    const last = rows.at(-1);
    expect(last?.type === "interim" && last.showHeader).toBe(false);
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
  const ctx = { view: "both" as const, density: "compact" as const, width: 1000, translations: {} };
  const row = (text: string, showHeader = true): VirtualRow => ({
    type: "segment",
    segment: seg(1, text),
    key: "s1",
    showHeader,
  });
  const tr = (text: string) => ({ s1: { lang: "en" as const, text, provider: "p" } });

  it("grows with text length and adds the translation in both view", () => {
    const short = estimateRowHeight(row("ngắn"), ctx);
    const long = estimateRowHeight(row("x".repeat(300)), ctx);
    expect(long).toBeGreaterThan(short + 60);
    const withTranslation = estimateRowHeight(row("ngắn"), { ...ctx, translations: tr("short") });
    expect(withTranslation).toBeGreaterThan(short);
    expect(
      estimateRowHeight(row("ngắn"), { ...ctx, view: "source", translations: tr("short") }),
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

  it("conclusion rows are one fixed line: 32px compact, 40px comfortable (measured 2026-10-24)", () => {
    const mark: Mark = { id: "k", kind: "conclusion", atMs: 0, label: null };
    const k = { type: "conclusion" as const, mark, key: "conclusion-k" };
    expect(estimateRowHeight(k, ctx)).toBe(32);
    expect(estimateRowHeight(k, { ...ctx, density: "comfortable" })).toBe(40);
  });

  it("matches heights measured in the browser, compact (scroller 690px, 2026-10-24)", () => {
    const source = { ...ctx, view: "source" as const, width: 690 };
    const both = { ...ctx, width: 690 };
    // turn start: row 10 + name line 23 + bubble 12 + text
    expect(estimateRowHeight(row("x".repeat(55)), source)).toBeCloseTo(71.4, 0);
    expect(estimateRowHeight(row("x".repeat(89)), source)).toBeCloseTo(97.8, 0);
    expect(
      estimateRowHeight(row("x".repeat(60)), { ...both, translations: tr("y".repeat(60)) }),
    ).toBeCloseTo(96.1, 0);
    // continuation: row 4 + bubble 12 + text
    expect(estimateRowHeight(row("x".repeat(55), false), source)).toBeCloseTo(42.4, 0);
    expect(
      estimateRowHeight(row("x".repeat(60), false), { ...both, translations: tr("y".repeat(60)) }),
    ).toBeCloseTo(67.1, 0);
    // 165 characters wrap to three lines
    expect(estimateRowHeight(row("x".repeat(165), false), source)).toBeCloseTo(95.2, 0);
  });

  it("matches heights measured in the browser, comfortable (scroller 690px)", () => {
    const wide = { ...ctx, density: "comfortable" as const, view: "source" as const, width: 690 };
    const both = { ...wide, view: "both" as const };
    expect(estimateRowHeight(row("x".repeat(55)), wide)).toBeCloseTo(94.0, 0);
    expect(
      estimateRowHeight(row("x".repeat(60)), { ...both, translations: tr("y".repeat(60)) }),
    ).toBeCloseTo(120.7, 0);
    expect(
      estimateRowHeight(row("x".repeat(60), false), { ...both, translations: tr("y".repeat(60)) }),
    ).toBeCloseTo(87.1, 0);
  });

  it("is shorter without the speaker line and in the compact density", () => {
    const text = "x".repeat(55);
    expect(estimateRowHeight(row(text, false), ctx)).toBeLessThan(
      estimateRowHeight(row(text), ctx),
    );
    expect(estimateRowHeight(row(text), ctx)).toBeLessThan(
      estimateRowHeight(row(text), { ...ctx, density: "comfortable" }),
    );
  });

  it("wraps earlier as the scroller gets narrower (sidebar present)", () => {
    const text = "x".repeat(120);
    const at = (width: number) => estimateRowHeight(row(text), { ...ctx, width });
    expect(at(700)).toBeGreaterThanOrEqual(at(1000));
    expect(at(560)).toBeGreaterThan(at(1000));
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
