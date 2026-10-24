import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATE,
  activeChips,
  activeFilterCount,
  clearedState,
  listHref,
  parseListState,
  toSearchParams,
  withoutChip,
} from "./list-query";

describe("list url state", () => {
  it("parses every param and falls back to defaults for junk", () => {
    expect(
      parseListState({
        q: " giá ",
        status: "ended",
        minutes: "stale",
        lang: "multi",
        range: "30d",
        sort: "duration",
      }),
    ).toEqual({
      ...DEFAULT_STATE,
      q: "giá",
      status: "ended",
      minutes: "stale",
      lang: "multi",
      range: "30d",
      sort: "duration",
    });
    // removed sort values (cost) fall back to the default instead of failing
    expect(parseListState({ sort: "cost" }).sort).toBe("auto");
    expect(
      parseListState({ status: "x", minutes: "y", lang: "auto", range: "z", sort: "q" }),
    ).toEqual(DEFAULT_STATE);
    expect(parseListState(new URLSearchParams("status=live&q=a"))).toMatchObject({
      status: "live",
      q: "a",
    });
  });

  it("custom range needs valid day keys; from/to alone imply custom", () => {
    expect(parseListState({ range: "custom", from: "2026-10-01", to: "2026-13-01" })).toMatchObject(
      {
        range: "custom",
        from: "2026-10-01",
        to: "",
      },
    );
    expect(parseListState({ from: "2026-10-01" })).toMatchObject({
      range: "custom",
      from: "2026-10-01",
    });
    expect(parseListState({ range: "7d", from: "2026-10-01" })).toMatchObject({
      range: "7d",
      from: "",
    });
  });

  it("round-trips through the url and omits defaults", () => {
    expect(listHref(DEFAULT_STATE)).toBe("/meetings");
    const state = parseListState({
      q: "giá hợp đồng",
      status: "ended",
      range: "custom",
      from: "2026-10-01",
      to: "2026-10-22",
      sort: "name",
      minutes: "none",
      lang: "en",
    });
    const href = listHref(state);
    expect(href).toBe(
      "/meetings?q=gi%C3%A1+h%E1%BB%A3p+%C4%91%E1%BB%93ng&status=ended&minutes=none&lang=en&range=custom&from=2026-10-01&to=2026-10-22&sort=name",
    );
    expect(parseListState(new URLSearchParams(href.split("?")[1]))).toEqual(state);
    expect(toSearchParams({ ...state, range: "7d" }).has("from")).toBe(false);
  });

  it("builds removable chips and resets one filter at a time", () => {
    const state = parseListState({
      q: "x",
      status: "live",
      minutes: "vi",
      lang: "en",
      range: "custom",
      from: "2026-10-01",
      to: "2026-10-22",
    });
    expect(activeFilterCount(state)).toBe(4);
    expect(activeChips(state).map((c) => c.label)).toEqual([
      "“x”",
      "Đang họp",
      "Biên bản: Có biên bản VI",
      "Ngôn ngữ: English",
      "01/10/2026 – 22/10/2026",
    ]);
    const noRange = withoutChip(state, "range");
    expect(noRange).toMatchObject({ range: "all", from: "", to: "" });
    expect(withoutChip(state, "q").q).toBe("");
    expect(clearedState({ ...state, sort: "oldest" })).toEqual({
      ...DEFAULT_STATE,
      sort: "oldest",
    });
  });
});
