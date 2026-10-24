import type { Mark, Segment } from "@recap/core";
import { describe, expect, it } from "vitest";
import { conclusionRequest, resolveJumpIndex } from "./use-transcript-jump";
import { buildVirtualRows } from "./virtual-rows";

const seg = (n: number): Segment => ({
  id: `s${n}`,
  seq: n,
  channel: 1,
  lang: "vi",
  startMs: n * 10_000,
  endMs: n * 10_000 + 5_000,
  text: `t${n}`,
});
const mark: Mark = { id: "k", kind: "conclusion", atMs: 12_000, label: null };
const target = { id: "s1", seq: 1, startMs: 10_000, text: "t1" };
const open = { prevCursor: null, nextCursor: null };
const rowsFor = (hasNext: boolean) =>
  buildVirtualRows({
    segments: [seg(0), seg(1), seg(2)],
    marks: [mark],
    edges: { hasPrev: false, hasNext },
    interim: { 0: null, 1: null },
    showInterim: false,
  });

describe("conclusion jump", () => {
  it("lands on the divider when it is loaded", () => {
    expect(resolveJumpIndex(conclusionRequest(mark, target), rowsFor(false), open)).toBe(2);
  });

  it("falls back to the anchor segment when the divider is not in the run", () => {
    const rows = buildVirtualRows({
      segments: [seg(0), seg(1)],
      marks: [mark],
      edges: { hasPrev: false, hasNext: true },
      interim: { 0: null, 1: null },
      showInterim: false,
    });
    expect(resolveJumpIndex(conclusionRequest(mark, target), rows, open)).toBe(1);
  });

  it("is not resolved while the anchor is not loaded (the pager loads its page)", () => {
    const rows = buildVirtualRows({
      segments: [seg(5)],
      marks: [],
      edges: { hasPrev: true, hasNext: true },
      interim: { 0: null, 1: null },
      showInterim: false,
    });
    expect(resolveJumpIndex(conclusionRequest(mark, target), rows, open)).toBe(-1);
  });
});
