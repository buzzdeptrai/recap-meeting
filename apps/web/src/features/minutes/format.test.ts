import { describe, expect, it } from "vitest";
import { formatChip, transcriptHref } from "./format";

describe("minutes format", () => {
  it("formats chips as mm:ss and h:mm:ss", () => {
    expect(formatChip(0)).toBe("00:00");
    expect(formatChip(65_900)).toBe("01:05");
    expect(formatChip(3_725_000)).toBe("1:02:05");
    expect(formatChip(-5)).toBe("00:00");
  });

  it("builds a transcript link with an integer offset", () => {
    expect(transcriptHref("abc", 12_345.6)).toBe("/meetings/abc?t=12346");
  });
});
