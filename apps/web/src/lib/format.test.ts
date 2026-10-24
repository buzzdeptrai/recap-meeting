import { describe, expect, it } from "vitest";
import { formatClock, formatLangPair, formatSeconds, formatIsoDate } from "./format";

describe("format", () => {
  it("formats offsets as hh:mm:ss", () => {
    expect(formatClock(0)).toBe("00:00:00");
    expect(formatClock(767_900)).toBe("00:12:47");
    expect(formatClock(3_725_000)).toBe("01:02:05");
    expect(formatClock(-5)).toBe("00:00:00");
  });

  it("formats language pairs", () => {
    expect(formatLangPair("vi", "en")).toBe("VI → EN");
    expect(formatLangPair("multi", "vi")).toBe("VI+EN → VI");
    expect(formatLangPair(null, null)).toBe("—");
  });

  it("formats latency seconds", () => {
    expect(formatSeconds(940)).toBe("0.9 s");
  });
});

describe("formatIsoDate", () => {
  it("shows date-only strings the Vietnamese way and leaves other text alone", () => {
    expect(formatIsoDate("2026-10-22")).toBe("22/10/2026");
    expect(formatIsoDate("tháng 10")).toBe("tháng 10");
  });
});
