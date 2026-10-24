import type { StoredSegment, Translation } from "@recap/db";
import { describe, expect, it } from "vitest";
import {
  buildTranscriptLines,
  formatTimestamp,
  markWindow,
  parseTimestamp,
  splitIntoChunks,
} from "../src/transcript";

const seg = (over: Partial<StoredSegment> & { id: string; seq: number }): StoredSegment => ({
  meetingId: "m",
  channel: 1,
  lang: "vi",
  startMs: 0,
  endMs: 1_000,
  text: "xin chào",
  createdAt: "t",
  ...over,
});

const tr = (segmentId: string, lang: "vi" | "en", text: string): Translation => ({
  segmentId,
  lang,
  text,
  provider: "fake",
  latencyMs: 1,
  createdAt: "t",
});

describe("timestamps", () => {
  it("formats and parses mm:ss round trip, minutes beyond 59", () => {
    expect(formatTimestamp(65_400)).toBe("01:05");
    expect(formatTimestamp(4_503_000)).toBe("75:03");
    expect(parseTimestamp("75:03")).toBe(4_503_000);
    expect(parseTimestamp("[01:05]")).toBe(65_000);
    expect(parseTimestamp("1:01:05")).toBe(3_665_000);
  });

  it("returns null for junk", () => {
    for (const bad of ["", "abc", "1:99", null, undefined]) expect(parseTimestamp(bad)).toBeNull();
  });
});

describe("buildTranscriptLines language selection", () => {
  const segments = [
    seg({ id: "a", seq: 0, channel: 0, lang: "vi", text: "Chào anh" }),
    seg({ id: "b", seq: 1, channel: 1, lang: "en", text: "Hello", startMs: 5_000 }),
    seg({ id: "c", seq: 2, channel: 1, lang: "en", text: "No translation", startMs: 9_000 }),
    seg({ id: "d", seq: 3, channel: 1, lang: null, text: "Mystery", startMs: 12_000 }),
  ];
  const translations = [tr("b", "vi", "Xin chào"), tr("a", "en", "Hi")];

  it("uses original when already in the target language, translation otherwise, original as fallback", () => {
    const lines = buildTranscriptLines(segments, translations, "vi").map((l) => l.text);
    expect(lines).toEqual([
      "[00:00] Tôi (vi): Chào anh",
      "[00:05] Người khác (vi): Xin chào",
      "[00:09] Người khác (en): No translation",
      "[00:12] Người khác (auto): Mystery",
    ]);
  });

  it("targets English the other way round", () => {
    const lines = buildTranscriptLines(segments, translations, "en").map((l) => l.text);
    expect(lines[0]).toBe("[00:00] Tôi (en): Hi");
    expect(lines[1]).toBe("[00:05] Người khác (en): Hello");
  });

  it("orders by seq and skips empty text", () => {
    const lines = buildTranscriptLines(
      [
        seg({ id: "x", seq: 2, text: "later" }),
        seg({ id: "y", seq: 1, text: " " }),
        seg({ id: "z", seq: 0, text: "first" }),
      ],
      [],
      "vi",
    );
    expect(lines.map((l) => l.text.split(": ")[1])).toEqual(["first", "later"]);
  });
});

describe("markWindow and chunking", () => {
  const lines = [0, 30_000, 70_000, 100_000, 130_000, 140_000].map((startMs) => ({
    startMs,
    endMs: startMs + 1_000,
    text: `line ${startMs}`,
  }));
  const spec = { beforeMs: 90_000, afterMs: 15_000 };
  const starts = (found: { startMs: number }[]) => found.map((l) => l.startMs);

  it("takes 90 s before and 15 s after the mark", () => {
    // mark at 100s -> window [10s, 115s]
    expect(starts(markWindow(lines, 100_000, spec))).toEqual([30_000, 70_000, 100_000]);
  });

  it("returns nothing for no lines and everything near when there are no markers", () => {
    expect(markWindow([], 5_000, spec)).toEqual([]);
    expect(starts(markWindow(lines, 135_000, spec))).toEqual([70_000, 100_000, 130_000, 140_000]);
  });

  it("works at the start and the end of the meeting", () => {
    expect(starts(markWindow(lines, 20_000, spec))).toEqual([0, 30_000]);
    expect(starts(markWindow(lines, 0, spec))).toEqual([0]);
    expect(starts(markWindow(lines, 500_000, spec))).toEqual([]);
    expect(starts(markWindow(lines, 145_000, spec))).toEqual([70_000, 100_000, 130_000, 140_000]);
  });

  it("includes segments straddling an edge whole", () => {
    const wide = [
      { startMs: 0, endMs: 12_000, text: "straddles before" },
      { startMs: 113_000, endMs: 140_000, text: "straddles after" },
      { startMs: 116_000, endMs: 118_000, text: "outside" },
    ];
    // mark 100s -> window [10s, 115s]
    expect(markWindow(wide, 100_000, spec).map((l) => l.text)).toEqual([
      "straddles before",
      "straddles after",
    ]);
  });

  describe("marker boundaries", () => {
    const boundary = (atMs: number) => ({
      startMs: atMs,
      endMs: atMs,
      text: `=== ${atMs} ===`,
      boundary: true as const,
    });
    const line = (startMs: number, endMs = startMs + 1_000) => ({
      startMs,
      endMs,
      text: `l${startMs}`,
    });
    const texts = (found: { text: string }[]) => found.map((l) => l.text);

    it("stops 'after' at the next conclusion mark", () => {
      const l = [line(100_000), line(105_000), line(110_000)];
      expect(texts(markWindow(l, 100_000, spec, [100_000, 106_000]))).toEqual([
        "l100000",
        "l105000",
      ]);
    });

    it("stops 'after' at the next topic marker, even inside the 15 s", () => {
      const l = [line(100_000), boundary(104_000), line(104_500), line(106_000)];
      expect(texts(markWindow(l, 100_000, spec))).toEqual(["l100000"]);
    });

    it("stops 'before' at the previous topic marker and keeps its boundary line", () => {
      const l = [line(10_000), boundary(40_000), line(41_000), line(90_000)];
      expect(texts(markWindow(l, 95_000, spec))).toEqual(["=== 40000 ===", "l41000", "l90000"]);
    });

    it("drops a segment that starts before the marker but ends after it", () => {
      const l = [line(30_000, 45_000), boundary(40_000), line(50_000)];
      expect(texts(markWindow(l, 60_000, spec))).toEqual(["=== 40000 ===", "l50000"]);
    });

    it("omits a boundary line that is older than the window", () => {
      const l = [boundary(0), line(1_000), line(200_000)];
      expect(texts(markWindow(l, 205_000, spec))).toEqual(["l200000"]);
    });

    it("does NOT stop 'before' at a previous conclusion mark: windows overlap", () => {
      const l = [line(60_000), line(80_000), line(100_000)];
      const first = markWindow(l, 85_000, spec, [85_000, 105_000]);
      const second = markWindow(l, 105_000, spec, [85_000, 105_000]);
      expect(texts(first)).toEqual(["l60000", "l80000", "l100000"]);
      expect(texts(second)).toEqual(["l60000", "l80000", "l100000"]);
    });

    it("treats a topic marker exactly at the mark as the start of the topic", () => {
      const l = [line(90_000), boundary(100_000), line(101_000)];
      expect(texts(markWindow(l, 100_000, spec))).toEqual(["=== 100000 ===", "l101000"]);
    });

    it("ignores another mark at the same time", () => {
      const l = [line(99_000), line(101_000)];
      expect(texts(markWindow(l, 100_000, spec, [100_000, 100_000]))).toEqual([
        "l99000",
        "l101000",
      ]);
    });

    it("handles a resumed meeting whose times continue after the base offset", () => {
      const base = 3_600_000;
      const l = [line(base - 1_000), boundary(base), line(base + 5_000), line(base + 60_000)];
      expect(texts(markWindow(l, base + 30_000, spec))).toEqual([
        `=== ${base} ===`,
        `l${base + 5_000}`,
      ]);
    });
  });

  it("splits into chunks without losing or reordering lines", () => {
    const chunks = splitIntoChunks(lines, 10);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toEqual(lines);
    expect(splitIntoChunks([], 10)).toEqual([]);
  });
});
