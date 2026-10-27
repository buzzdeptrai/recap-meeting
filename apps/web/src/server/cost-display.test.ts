import { describe, expect, it } from "vitest";
import { costDisplayMultiplier, isCostScaled, scaleCost } from "./cost-display";

describe("cost display multiplier", () => {
  it("defaults to 1 when unset", () => {
    expect(costDisplayMultiplier({})).toBe(1);
    expect(isCostScaled(1)).toBe(false);
  });

  it("reads a positive number", () => {
    expect(costDisplayMultiplier({ USAGE_COST_DISPLAY_MULTIPLIER: "5" })).toBe(5);
    expect(costDisplayMultiplier({ USAGE_COST_DISPLAY_MULTIPLIER: "1.5" })).toBe(1.5);
    expect(isCostScaled(5)).toBe(true);
  });

  it.each(["0", "-2", "abc", "", "Infinity", "NaN"])("falls back to 1 for %j", (value) => {
    expect(costDisplayMultiplier({ USAGE_COST_DISPLAY_MULTIPLIER: value })).toBe(1);
  });

  it("scales amounts", () => {
    expect(scaleCost(2, 5)).toBe(10);
    expect(scaleCost(2, 1)).toBe(2);
  });
});
