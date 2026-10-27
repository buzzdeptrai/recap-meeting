import { NOTE_CONTENT_MAX } from "@recap/core";
import { describe, expect, it } from "vitest";
import {
  buildSelectionDraft,
  fitNoteContent,
  isDuplicateNote,
  normalizeSelectionText,
  parseStartMs,
  placeAction,
} from "./selection-note";

describe("normalizeSelectionText / fitNoteContent", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeSelectionText("  a \n\n b\t c  ")).toBe("a b c");
  });
  it("never returns an empty note", () => {
    expect(fitNoteContent(" \n\t ")).toBeNull();
    expect(fitNoteContent("")).toBeNull();
  });
  it("keeps text at the limit and ends longer text with an ellipsis inside the limit", () => {
    const exact = "x".repeat(NOTE_CONTENT_MAX);
    expect(fitNoteContent(exact)).toBe(exact);
    const cut = fitNoteContent("y".repeat(NOTE_CONTENT_MAX + 50));
    expect(cut).toHaveLength(NOTE_CONTENT_MAX);
    expect(cut?.endsWith("…")).toBe(true);
  });
  it("does not leave a space before the ellipsis", () => {
    const text = "a".repeat(NOTE_CONTENT_MAX - 2) + " bbbb";
    expect(fitNoteContent(text)?.endsWith("a…")).toBe(true);
  });
});

describe("parseStartMs", () => {
  it("parses whole and fractional offsets", () => {
    expect(parseStartMs("12000")).toBe(12000);
    expect(parseStartMs("0")).toBe(0);
    expect(parseStartMs("1500.9")).toBe(1500);
  });
  it("returns null for missing or invalid values", () => {
    for (const bad of [null, undefined, "", " ", "abc", "-5", "NaN"]) {
      expect(parseStartMs(bad)).toBeNull();
    }
  });
});

describe("buildSelectionDraft", () => {
  it("uses the start row time and the normalised text", () => {
    expect(buildSelectionDraft(" hello \n world ", "4200")).toEqual({
      content: "hello world",
      atMs: 4200,
    });
  });
  it("falls back to an untimed note when the row has no time", () => {
    expect(buildSelectionDraft("hi", null)).toEqual({ content: "hi", atMs: null });
  });
  it("is null for an empty selection", () => {
    expect(buildSelectionDraft("  ", "10")).toBeNull();
  });
});

describe("isDuplicateNote", () => {
  const notes = [{ id: "1", atMs: 1000, content: "same  text" }];
  it("matches same text and same offset", () => {
    expect(isDuplicateNote(notes, { content: "same text", atMs: 1000 })).toBe(true);
  });
  it("differs by offset or text", () => {
    expect(isDuplicateNote(notes, { content: "same text", atMs: 2000 })).toBe(false);
    expect(isDuplicateNote(notes, { content: "other", atMs: 1000 })).toBe(false);
  });
});

describe("placeAction", () => {
  const bounds = { left: 0, top: 0, right: 400, bottom: 300 };
  const size = { width: 100, height: 30 };
  const box = (left: number, top: number, right: number, bottom: number) => ({
    left,
    top,
    right,
    bottom,
  });
  it("sits under the selection end, right-aligned", () => {
    const sel = { first: box(50, 50, 200, 70), last: box(50, 50, 200, 70) };
    expect(placeAction(sel, size, bounds)).toEqual({ left: 100, top: 78 });
  });
  it("flips above when there is no room below", () => {
    const sel = { first: box(50, 250, 200, 270), last: box(50, 250, 200, 270) };
    expect(placeAction(sel, size, bounds).top).toBe(212);
  });
  it("clamps inside the bounds", () => {
    const sel = { first: box(0, 0, 20, 10), last: box(0, 0, 20, 10) };
    const spot = placeAction(sel, size, bounds);
    expect(spot.left).toBe(8);
    const far = { first: box(380, 100, 999, 110), last: box(380, 100, 999, 110) };
    expect(placeAction(far, size, bounds).left).toBe(292);
  });
});
