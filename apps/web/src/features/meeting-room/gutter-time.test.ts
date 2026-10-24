import { describe, expect, it } from "vitest";
import { formatGutterTime } from "./gutter-time";

describe("formatGutterTime", () => {
  it("drops the hours below one hour and leading zeros", () => {
    expect(formatGutterTime(0)).toBe("0:00");
    expect(formatGutterTime(255_000)).toBe("4:15");
    expect(formatGutterTime(754_000)).toBe("12:34");
  });

  it("keeps the hours from one hour on", () => {
    expect(formatGutterTime(3_723_000)).toBe("1:02:03");
    expect(formatGutterTime(36_000_000)).toBe("10:00:00");
  });
});
