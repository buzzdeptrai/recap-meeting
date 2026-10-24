import type { Mark, Segment } from "@recap/core";
import { describe, expect, it } from "vitest";
import { buildTranscriptRows, findNewTopicId, topicName } from "./topics";

const seg = (n: number, startMs = n * 10_000): Segment => ({
  id: `s${n}`,
  seq: n,
  channel: 1,
  lang: "vi",
  startMs,
  endMs: startMs + 5_000,
  text: `t${n}`,
});
const topic = (id: string, atMs: number, label: string | null = null): Mark => ({
  id,
  kind: "topic",
  atMs,
  label,
});

const shape = (rows: ReturnType<typeof buildTranscriptRows>) =>
  rows.map((r) => {
    if (r.type === "divider") return `D:${r.name}`;
    if (r.type === "conclusion") return `C:${r.mark.id}`;
    return r.segment.id;
  });

describe("buildTranscriptRows", () => {
  const segments = [seg(0), seg(1), seg(2)];

  it("puts a divider before the first segment starting at or after the marker", () => {
    const rows = buildTranscriptRows(segments, [topic("a", 10_000, "Giá")]);
    expect(shape(rows)).toEqual(["s0", "D:Giá", "s1", "s2"]);
  });

  it("a marker inside a segment goes after that segment", () => {
    expect(shape(buildTranscriptRows(segments, [topic("a", 12_000, "X")]))).toEqual([
      "s0",
      "s1",
      "D:X",
      "s2",
    ]);
  });

  it("numbers unnamed topics by position and keeps trailing/leading markers", () => {
    // marks arrive sorted by time from the reducer
    const rows = buildTranscriptRows(segments, [
      topic("a", 0, "Mở đầu"),
      topic("c", 15_000),
      topic("b", 99_000),
    ]);
    expect(shape(rows)).toEqual(["D:Mở đầu", "s0", "s1", "D:Chủ đề 2", "s2", "D:Chủ đề 3"]);
  });

  it("returns plain segments when there are no marks", () => {
    expect(shape(buildTranscriptRows(segments, []))).toEqual(["s0", "s1", "s2"]);
  });
});

describe("topicName / findNewTopicId", () => {
  it("falls back to Chủ đề N for blank labels", () => {
    const topics = [topic("a", 0, "  "), topic("b", 5)];
    expect(topicName(topics[0] as Mark, topics)).toBe("Chủ đề 1");
    expect(topicName(topics[1] as Mark, topics)).toBe("Chủ đề 2");
  });

  it("finds the topic that appeared since the known ids", () => {
    const marks = [topic("a", 0), topic("b", 5)];
    expect(findNewTopicId(new Set(["a"]), marks)).toBe("b");
    expect(findNewTopicId(new Set(["a", "b"]), marks)).toBeNull();
  });
});

describe("buildTranscriptRows over a window of the meeting", () => {
  const segments = [seg(5), seg(6), seg(7)];
  const marks = [topic("early", 45_000), topic("mid", 60_000), topic("late", 500_000)];

  it("omits dividers before the first row when earlier segments are not loaded", () => {
    const rows = buildTranscriptRows(segments, marks, { hasPrev: true, hasNext: false });
    expect(shape(rows)).toEqual(["s5", "D:Chủ đề 2", "s6", "s7", "D:Chủ đề 3"]);
  });

  it("omits trailing dividers while later segments are not loaded", () => {
    const rows = buildTranscriptRows(segments, marks, { hasPrev: false, hasNext: true });
    expect(shape(rows)).toEqual(["D:Chủ đề 1", "s5", "D:Chủ đề 2", "s6", "s7"]);
  });

  it("keeps the whole-meeting behaviour by default", () => {
    expect(shape(buildTranscriptRows(segments, marks)).at(-1)).toBe("D:Chủ đề 3");
  });
});

describe("conclusion rows", () => {
  const conclusion = (id: string, atMs: number, label: string | null = null): Mark => ({
    id,
    kind: "conclusion",
    atMs,
    label,
  });
  const segments = [seg(0), seg(1), seg(2)];

  it("is one row after the segment that spans the mark, not a tag on every nearby segment", () => {
    const rows = buildTranscriptRows(segments, [conclusion("k", 12_000)]);
    expect(shape(rows)).toEqual(["s0", "s1", "C:k", "s2"]);
  });

  it("puts a topic before a conclusion at the same instant, whatever the input order", () => {
    const marks = [conclusion("k", 10_000), topic("t", 10_000, "Giá")];
    expect(shape(buildTranscriptRows(segments, marks))).toEqual(["s0", "D:Giá", "C:k", "s1", "s2"]);
  });

  it("keeps several conclusions near one segment in time order", () => {
    const marks = [conclusion("k2", 13_000), conclusion("k1", 11_000), conclusion("k3", 13_000)];
    expect(shape(buildTranscriptRows(segments, marks))).toEqual([
      "s0",
      "s1",
      "C:k1",
      "C:k2",
      "C:k3",
      "s2",
    ]);
  });

  it("puts a conclusion after the last segment at the end", () => {
    expect(shape(buildTranscriptRows(segments, [conclusion("k", 900_000)])).at(-1)).toBe("C:k");
  });

  it("leaves out conclusions whose anchor neighbourhood is not loaded", () => {
    const loaded = [seg(5), seg(6), seg(7)];
    const marks = [
      conclusion("before", 20_000),
      conclusion("mid", 62_000),
      conclusion("after", 900_000),
    ];
    expect(shape(buildTranscriptRows(loaded, marks, { hasPrev: true, hasNext: true }))).toEqual([
      "s5",
      "s6",
      "C:mid",
      "s7",
    ]);
  });
});
