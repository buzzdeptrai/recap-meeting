import { describe, expect, it } from "vitest";
import {
  bezierPoint,
  monotoneSegments,
  roundedTopRect,
  smoothAreaPath,
  smoothBandPath,
  smoothLinePath,
  type Point,
} from "../src/lib/curve";

function pointsOf(ys: number[], dx = 20): Point[] {
  return ys.map((y, i) => [i * dx, y]);
}

/** Sample every segment densely; return the extreme y values reached by the curve. */
function sampledRange(points: Point[]): { min: number; max: number } {
  const segs = monotoneSegments(points);
  let min = Infinity;
  let max = -Infinity;
  segs.forEach((s, i) => {
    for (let t = 0; t <= 1; t += 0.01) {
      const y = bezierPoint(points[i]!, s, t)[1];
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
  });
  return { min, max };
}

describe("monotoneSegments", () => {
  it("never leaves the data range (spiky data with zeros)", () => {
    const data = [1.34, 3.49, 0, 0, 1.65, 2.35, 3.18, 1.91, 2.54, 0, 0, 1.07, 3.22, 2.88, 0];
    const { min, max } = sampledRange(pointsOf(data));
    expect(min).toBeGreaterThanOrEqual(0 - 1e-9);
    expect(max).toBeLessThanOrEqual(3.49 + 1e-9);
  });

  it("never overshoots on random series (property check)", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let run = 0; run < 200; run++) {
      const ys = Array.from({ length: 2 + Math.floor(rnd() * 30) }, () =>
        rnd() < 0.2 ? 0 : rnd() * 100,
      );
      const xs: number[] = [];
      let x = 0;
      for (let i = 0; i < ys.length; i++) xs.push((x += 1 + rnd() * 40));
      const pts: Point[] = ys.map((y, i) => [xs[i]!, y]);
      const { min, max } = sampledRange(pts);
      expect(min).toBeGreaterThanOrEqual(Math.min(...ys) - 1e-6);
      expect(max).toBeLessThanOrEqual(Math.max(...ys) + 1e-6);
    }
  });

  it("keeps each segment between its two neighbours", () => {
    const pts = pointsOf([0, 10, 10, 0]);
    const segs = monotoneSegments(pts);
    segs.forEach((s, i) => {
      const lo = Math.min(pts[i]![1], pts[i + 1]![1]);
      const hi = Math.max(pts[i]![1], pts[i + 1]![1]);
      for (const c of [s.c1[1], s.c2[1]]) {
        expect(c).toBeGreaterThanOrEqual(lo);
        expect(c).toBeLessThanOrEqual(hi);
      }
    });
  });

  it("passes through every data point and is flat for constant data", () => {
    const pts = pointsOf([5, 5, 5]);
    const segs = monotoneSegments(pts);
    expect(segs.map((s) => s.to)).toEqual([pts[1], pts[2]]);
    segs.forEach((s) => expect([s.c1[1], s.c2[1]]).toEqual([5, 5]));
  });

  it("returns nothing for fewer than 2 points and tolerates duplicate x", () => {
    expect(monotoneSegments([[0, 1]])).toEqual([]);
    expect(() =>
      smoothLinePath([
        [0, 1],
        [0, 2],
        [10, 3],
      ]),
    ).not.toThrow();
    expect(smoothLinePath([])).toBe("");
  });
});

describe("path builders", () => {
  it("builds line, area and band paths", () => {
    const pts = pointsOf([1, 2, 1]);
    expect(smoothLinePath(pts).startsWith("M0 1C")).toBe(true);
    const area = smoothAreaPath(pts, 9);
    expect(area.endsWith("L40 9L0 9Z")).toBe(true);
    const band = smoothBandPath(pts, pointsOf([0, 0, 0]));
    expect(band.endsWith("Z")).toBe(true);
    expect(band).toContain("L40 0");
  });

  it("clamps the radius of rounded bars", () => {
    expect(roundedTopRect(0, 0, 10, 2, 99)).toContain("V2");
  });
});
