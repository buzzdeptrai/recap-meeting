import { describe, expect, it } from "vitest";
import {
  formatCompact,
  formatDelta,
  formatDuration,
  formatMs,
  formatNumber,
  formatPercent,
  formatUsd,
} from "../src/lib/format";

describe("formatNumber", () => {
  it("uses vi-VN separators", () => {
    expect(formatNumber(1234.5, 1)).toBe("1.234,5");
    expect(formatNumber(5670000)).toBe("5.670.000");
    expect(formatNumber(79.2, 1, true)).toBe("79,2");
    expect(formatNumber(79, 1, true)).toBe("79,0");
  });
  it("renders non-finite as a dash", () => {
    expect(formatNumber(Number.NaN)).toBe("–");
  });
});

describe("formatCompact", () => {
  it("abbreviates with Vietnamese units, 3 significant digits", () => {
    expect(formatCompact(6_590_000)).toBe("6,59 triệu");
    expect(formatCompact(12_300)).toBe("12,3 nghìn");
    expect(formatCompact(1_500_000_000)).toBe("1,5 tỷ");
    expect(formatCompact(250_000_000)).toBe("250 triệu");
  });
  it("keeps small numbers plain", () => {
    expect(formatCompact(38)).toBe("38");
    expect(formatCompact(79.2)).toBe("79,2");
  });
});

describe("formatUsd", () => {
  it("formats dollars with comma decimals", () => {
    expect(formatUsd(41.87)).toBe("$41,87");
    expect(formatUsd(1234.5)).toBe("$1.234,50");
    expect(formatUsd(0)).toBe("$0,00");
  });
  it("shows 4 decimals for sub-cent amounts", () => {
    expect(formatUsd(0.0042)).toBe("$0,0042");
  });
  it("handles negatives", () => {
    expect(formatUsd(-3)).toBe("-$3,00");
  });
});

describe("formatPercent / formatDelta", () => {
  it("signs positives on request", () => {
    expect(formatPercent(18.8, { sign: true })).toBe("+18,8%");
    expect(formatPercent(70, { decimals: 0 })).toBe("70%");
  });
  it("computes direction against the previous period", () => {
    expect(formatDelta(38, 32)).toEqual({ text: "+18,8%", direction: "up" });
    expect(formatDelta(8, 10)).toEqual({ text: "-20%", direction: "down" });
    expect(formatDelta(10, 10)).toEqual({ text: "0%", direction: "flat" });
  });
  it("returns null without a usable baseline", () => {
    expect(formatDelta(5, 0)).toBeNull();
    expect(formatDelta(Number.NaN, 3)).toBeNull();
  });
});

describe("formatDuration / formatMs", () => {
  it("long style", () => {
    expect(formatDuration(79 * 3600 + 12 * 60)).toBe("79 giờ 12 phút");
    expect(formatDuration(24 * 60 + 5)).toBe("24 phút 05 giây");
    expect(formatDuration(45)).toBe("45 giây");
  });
  it("clock style", () => {
    expect(formatDuration(3600 + 7 * 60 + 42, "clock")).toBe("01:07:42");
  });
  it("rejects negatives", () => {
    expect(formatDuration(-1)).toBe("–");
  });
  it("latency", () => {
    expect(formatMs(412)).toBe("412 ms");
    expect(formatMs(2400)).toBe("2,4 s");
  });
});
