import { describe, expect, it } from "vitest";
import {
  labelIndices,
  linearScale,
  maxOf,
  nearestIndex,
  niceAxis,
  niceStep,
  stepDecimals,
  stepIndex,
} from "../src/lib/scale";
import { stackLayers, totalsOf } from "../src/lib/stack";

describe("niceStep / niceAxis", () => {
  it("rounds up to 1, 2, 2.5, 5 x 10^k", () => {
    expect(niceStep(0.87)).toBe(1);
    expect(niceStep(1.1)).toBe(2);
    expect(niceStep(2.2)).toBe(2.5);
    expect(niceStep(3)).toBe(5);
    expect(niceStep(7)).toBe(10);
    expect(niceStep(0)).toBe(1);
  });
  it("builds an axis with a fixed number of intervals covering the data", () => {
    const axis = niceAxis(3.86, 4);
    expect(axis.ticks).toEqual([0, 1, 2, 3, 4]);
    expect(axis.max).toBe(4);
    const big = niceAxis(7.3, 4);
    expect(big.max).toBeGreaterThanOrEqual(7.3);
    expect(big.ticks).toHaveLength(5);
  });
  it("handles empty / zero data", () => {
    expect(niceAxis(0).ticks).toHaveLength(5);
    expect(niceAxis(Number.NaN).max).toBeGreaterThan(0);
  });
  it("avoids float noise", () => {
    expect(niceAxis(0.9, 4).ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});

describe("linearScale / maxOf", () => {
  it("maps domain to range, inverted ranges included", () => {
    const y = linearScale([0, 10], [100, 0]);
    expect(y(0)).toBe(100);
    expect(y(10)).toBe(0);
    expect(y(2.5)).toBe(75);
  });
  it("ignores non-finite values", () => {
    expect(maxOf([1, Number.NaN, 3])).toBe(3);
  });
});

describe("labelIndices", () => {
  it("always includes the last point and keeps spacing", () => {
    const idx = labelIndices(22, 300);
    expect(idx[idx.length - 1]).toBe(21);
    const gaps = idx.slice(1).map((v, i) => v - idx[i]!);
    expect(new Set(gaps).size).toBe(1);
  });
  it("shows everything when there is room", () => {
    expect(labelIndices(3, 600)).toEqual([0, 1, 2]);
  });
});

describe("cursor helpers", () => {
  it("maps pointer x to the nearest index", () => {
    expect(nearestIndex(0, 100, 5)).toBe(0);
    expect(nearestIndex(100, 100, 5)).toBe(4);
    expect(nearestIndex(60, 100, 5)).toBe(2);
    expect(nearestIndex(-50, 100, 5)).toBe(0);
    expect(nearestIndex(99, 100, 4, "band")).toBe(3);
    expect(nearestIndex(10, 100, 1)).toBe(0);
  });
  it("steps with arrow keys and clamps", () => {
    expect(stepIndex("ArrowRight", -1, 5)).toBe(4);
    expect(stepIndex("ArrowLeft", -1, 5)).toBe(3);
    expect(stepIndex("ArrowLeft", 0, 5)).toBe(0);
    expect(stepIndex("ArrowRight", 4, 5)).toBe(4);
    expect(stepIndex("Home", 3, 5)).toBe(0);
    expect(stepIndex("End", 0, 5)).toBe(4);
    expect(stepIndex("a", 0, 5)).toBeNull();
  });
});

describe("stacking", () => {
  it("accumulates and treats bad values as 0", () => {
    const layers = stackLayers(
      [
        [1, 2, Number.NaN],
        [3, -1, 4],
      ],
      3,
    );
    expect(layers[0]!.top).toEqual([1, 2, 0]);
    expect(layers[1]!.base).toEqual([1, 2, 0]);
    expect(layers[1]!.top).toEqual([4, 2, 4]);
    expect(
      totalsOf(
        [
          [1, 2],
          [3, 4],
        ],
        2,
      ),
    ).toEqual([4, 6]);
    expect(totalsOf([], 2)).toEqual([0, 0]);
  });
});

describe("stepDecimals", () => {
  it("returns enough decimals to keep axis labels distinct", () => {
    expect(stepDecimals(0.05)).toBe(2);
    expect(stepDecimals(0.5)).toBe(1);
    expect(stepDecimals(2)).toBe(0);
    expect(stepDecimals(0)).toBe(0);
  });
});
