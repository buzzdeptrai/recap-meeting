import { describe, expect, it } from "vitest";
import { startsTurn, TURN_GAP_MS, type TurnPoint } from "./turns";

const point = (channel: 0 | 1, startMs: number, endMs = startMs + 2_000): TurnPoint => ({
  channel,
  startMs,
  endMs,
});

describe("startsTurn", () => {
  it("starts a turn when there is no previous speech row (first row, divider, page edge)", () => {
    expect(startsTurn(null, point(0, 0))).toBe(true);
  });

  it("continues the turn for the same channel after a short pause", () => {
    expect(startsTurn(point(0, 0), point(0, 5_000))).toBe(false);
    expect(startsTurn(point(1, 0), point(1, 2_000))).toBe(false);
  });

  it("starts a turn when the channel changes", () => {
    expect(startsTurn(point(0, 0), point(1, 3_000))).toBe(true);
    expect(startsTurn(point(1, 0), point(0, 3_000))).toBe(true);
  });

  it("measures the pause from the end of the previous segment", () => {
    const previous = point(0, 0, 10_000);
    expect(startsTurn(previous, point(0, 10_000 + TURN_GAP_MS))).toBe(false);
    expect(startsTurn(previous, point(0, 10_000 + TURN_GAP_MS + 1))).toBe(true);
  });

  it("treats overlapping segments (negative gap) as continuing", () => {
    expect(startsTurn(point(0, 0, 8_000), point(0, 6_000))).toBe(false);
  });

  it("pins the pause limit", () => {
    expect(TURN_GAP_MS).toBe(30_000);
  });
});
