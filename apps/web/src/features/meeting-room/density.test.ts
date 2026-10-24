import { describe, expect, it } from "vitest";
import { DEFAULT_DENSITY, DENSITY_OPTIONS, isDensity, rowMetrics, rowStyle } from "./density";

describe("density", () => {
  it("defaults to compact and offers exactly two options", () => {
    expect(DEFAULT_DENSITY).toBe("compact");
    expect(DENSITY_OPTIONS.map((o) => o.label)).toEqual(["Gọn", "Thoải mái"]);
  });

  it("accepts only known densities (stored values are untrusted)", () => {
    expect(isDensity("compact")).toBe(true);
    expect(isDensity("comfortable")).toBe(true);
    expect(isDensity("huge")).toBe(false);
    expect(isDensity(null)).toBe(false);
  });

  it("pins the compact spacing the height estimate is built from", () => {
    expect(rowMetrics("compact")).toMatchObject({
      headerPadding: 10,
      continuationPadding: 4,
      metaHeight: 23,
      bubblePadding: 12,
      translationGap: 2,
      maxTextPx: 733,
    });
  });

  it("is tighter than comfortable in every vertical measure", () => {
    const compact = rowMetrics("compact");
    const comfortable = rowMetrics("comfortable");
    expect(compact.headerPadding).toBeLessThan(comfortable.headerPadding);
    expect(compact.continuationPadding).toBeLessThan(comfortable.continuationPadding);
    expect(compact.metaHeight).toBeLessThan(comfortable.metaHeight);
    expect(compact.bubblePadding).toBeLessThan(comfortable.bubblePadding);
    expect(compact.gutterWidePx).toBeLessThan(comfortable.gutterWidePx);
  });

  it("left-aligns compact rows and keeps the centred frame for comfortable", () => {
    expect(rowStyle("compact").grid).not.toContain("mx-auto");
    expect(rowStyle("comfortable").grid).toContain("mx-auto");
  });
});
