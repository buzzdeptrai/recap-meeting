import { describe, expect, it } from "vitest";
import { createSilenceTimer } from "./mic-test";

describe("createSilenceTimer", () => {
  it("is quiet only after the whole window without signal", () => {
    const timer = createSilenceTimer(1000, 0.01);
    expect(timer.feed(0, 0)).toBe(false);
    expect(timer.feed(0, 999)).toBe(false);
    expect(timer.feed(0, 1000)).toBe(true);
  });

  it("clears as soon as sound arrives", () => {
    const timer = createSilenceTimer(1000, 0.01);
    timer.feed(0, 0);
    expect(timer.feed(0, 1500)).toBe(true);
    expect(timer.feed(0.2, 1600)).toBe(false);
    expect(timer.feed(0, 2500)).toBe(false);
    expect(timer.feed(0, 2600)).toBe(true);
  });
});
