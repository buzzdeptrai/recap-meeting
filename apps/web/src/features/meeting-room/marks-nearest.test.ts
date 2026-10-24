import { describe, expect, it } from "vitest";
import { nearestSegmentId } from "./marks";

const segs = [
  { id: "a", startMs: 0, endMs: 4_000 },
  { id: "b", startMs: 5_000, endMs: 9_000 },
  { id: "c", startMs: 20_000, endMs: 25_000 },
];

describe("nearestSegmentId", () => {
  it("prefers the segment spanning the time", () => {
    expect(nearestSegmentId(segs, 6_000)).toBe("b");
  });
  it("picks the closest segment in a gap", () => {
    expect(nearestSegmentId(segs, 12_000)).toBe("b");
    expect(nearestSegmentId(segs, 18_000)).toBe("c");
    expect(nearestSegmentId(segs, 99_000)).toBe("c");
  });
  it("returns null without segments", () => {
    expect(nearestSegmentId([], 1)).toBeNull();
  });
});
