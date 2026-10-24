import { describe, expect, it } from "vitest";
import { rangeLabel } from "./usage-format";
import {
  DEFAULT_STATE,
  exportHref,
  localDate,
  parseTzMinutes,
  parseUsageState,
  rangeParams,
  usageHref,
} from "./usage-url";

const NOW = Date.parse("2026-10-22T05:00:00Z"); // 12:00 in Ho Chi Minh

describe("usage url state", () => {
  it("defaults when params are missing or invalid", () => {
    expect(parseUsageState({})).toEqual(DEFAULT_STATE);
    expect(parseUsageState({ range: "x", group: "meeting", metric: "??", tz: "abc" })).toEqual(
      DEFAULT_STATE,
    );
  });

  it("reads valid params and takes the first of repeated ones", () => {
    expect(
      parseUsageState({ range: ["7d", "30d"], group: "model", metric: "tokens", tz: "0" }),
    ).toEqual({
      range: "7d",
      group: "model",
      metric: "tokens",
      tz: 0,
    });
  });

  it("builds linkable urls and omits defaults", () => {
    expect(usageHref(DEFAULT_STATE)).toBe("/usage");
    expect(usageHref({ ...DEFAULT_STATE, range: "30d", metric: "seconds" })).toBe(
      "/usage?range=30d&metric=seconds",
    );
    expect(usageHref({ ...DEFAULT_STATE, group: "service", tz: -300 })).toBe(
      "/usage?group=service&tz=-300",
    );
  });

  it("round-trips through the url", () => {
    const state = { range: "7d", group: "model", metric: "requests", tz: 60 } as const;
    const query = Object.fromEntries(new URL(usageHref(state), "http://x").searchParams);
    expect(parseUsageState(query)).toEqual(state);
  });

  it("validates tz minutes", () => {
    expect(parseTzMinutes("420")).toBe(420);
    expect(parseTzMinutes("-90")).toBe(-90);
    expect(parseTzMinutes("900")).toBeNull();
    expect(parseTzMinutes("+07:00")).toBeNull();
    expect(parseTzMinutes(undefined)).toBeNull();
  });
});

describe("range params", () => {
  it("month runs from the 1st to today in local dates", () => {
    expect(rangeParams(DEFAULT_STATE, NOW)).toEqual({
      from: "2026-10-01",
      to: "2026-10-22",
      tz: "420",
    });
  });

  it("7 and 30 days end today inclusive, in local dates", () => {
    expect(rangeParams({ ...DEFAULT_STATE, range: "7d" }, NOW)).toEqual({
      from: "2026-10-16",
      to: "2026-10-22",
      tz: "420",
    });
    expect(rangeParams({ ...DEFAULT_STATE, range: "30d" }, NOW).from).toBe("2026-09-23");
  });

  it("uses the local day near midnight", () => {
    const lateUtc = Date.parse("2026-10-21T18:30:00Z"); // 01:30 on the 22nd locally
    expect(localDate(lateUtc, 420)).toBe("2026-10-22");
    expect(localDate(lateUtc, 0)).toBe("2026-10-21");
  });

  it("export link carries the current filters", () => {
    const href = exportHref({ ...DEFAULT_STATE, range: "7d" }, NOW, "vendor");
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/api/usage/export.csv");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: "2026-10-16",
      to: "2026-10-22",
      tz: "420",
      groupBy: "vendor",
    });
  });

  it("labels an exclusive-end range by its last local day", () => {
    expect(
      rangeLabel({
        from: "2026-09-30T17:00:00.000Z",
        to: "2026-10-22T05:00:00.000Z",
        tzOffsetMinutes: 420,
      }),
    ).toBe("01/10 – 22/10/2026");
  });
});
