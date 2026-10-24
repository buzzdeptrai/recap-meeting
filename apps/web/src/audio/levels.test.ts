import { describe, expect, it } from "vitest";
import { levelToBars, METER_BARS, rmsToLevel, smoothLevel } from "./levels";

describe("levels", () => {
  it("maps rms to a 0..1 dB level", () => {
    expect(rmsToLevel(0)).toBe(0);
    expect(rmsToLevel(1)).toBe(1);
    expect(rmsToLevel(0.001)).toBeCloseTo(0, 5);
    expect(rmsToLevel(0.1)).toBeCloseTo(0.667, 2);
  });

  it("rises instantly and falls gradually", () => {
    expect(smoothLevel(0.2, 0.8)).toBe(0.8);
    const fallen = smoothLevel(0.8, 0);
    expect(fallen).toBeLessThan(0.8);
    expect(fallen).toBeGreaterThan(0.5);
  });

  it("converts levels to lit bars", () => {
    expect(levelToBars(0)).toBe(0);
    expect(levelToBars(0.05)).toBe(1);
    expect(levelToBars(0.5)).toBe(4);
    expect(levelToBars(1)).toBe(METER_BARS);
  });
});
