import { describe, expect, it } from "vitest";
import { matchesPath, resolveActiveItem } from "../src/shell/active";
import type { NavGroup } from "../src/shell/types";
import { nextSort, sortRows } from "../src/lib/sort";

describe("sortRows", () => {
  const rows = [
    { n: "b", v: 2 },
    { n: "a", v: null },
    { n: "c", v: 10 },
    { n: "d", v: 2 },
  ];
  it("sorts numbers, keeps ties stable, sinks missing values", () => {
    expect(sortRows(rows, (r) => r.v, "asc").map((r) => r.n)).toEqual(["b", "d", "c", "a"]);
    expect(sortRows(rows, (r) => r.v, "desc").map((r) => r.n)).toEqual(["c", "b", "d", "a"]);
  });
  it("sorts Vietnamese strings with locale rules and numeric runs", () => {
    const names = ["Đà Nẵng", "Cần Thơ", "Hà Nội", "Hue 10", "Hue 9"];
    expect(sortRows(names, (s) => s, "asc")).toEqual([
      "Cần Thơ",
      "Đà Nẵng",
      "Hà Nội",
      "Hue 9",
      "Hue 10",
    ]);
  });
  it("does not mutate the input", () => {
    const copy = [...rows];
    sortRows(rows, (r) => r.v, "desc");
    expect(rows).toEqual(copy);
  });
  it("cycles direction per column", () => {
    expect(nextSort(null, "a")).toEqual({ key: "a", direction: "asc" });
    expect(nextSort({ key: "a", direction: "asc" }, "a")).toEqual({ key: "a", direction: "desc" });
    expect(nextSort({ key: "a", direction: "desc" }, "b")).toEqual({ key: "b", direction: "asc" });
  });
});

const icon = null;
const groups: NavGroup[] = [
  { items: [{ label: "Tổng quan", href: "/", icon }] },
  {
    label: "Làm việc",
    items: [
      { label: "Cuộc họp", href: "/meetings", icon },
      { label: "Họp mới", href: "/meetings/new", icon },
      { label: "Sắp ra mắt", href: "/soon", icon, disabled: true },
    ],
  },
  { label: "Quản trị", items: [{ label: "Mức sử dụng", href: "/usage", icon }] },
];

describe("matchesPath / resolveActiveItem", () => {
  it("matches by segment, not by string prefix", () => {
    expect(matchesPath("/meetings/abc", "/meetings")).toBe(true);
    expect(matchesPath("/meetings-old", "/meetings")).toBe(false);
    expect(matchesPath("/usage/", "/usage")).toBe(true);
    expect(matchesPath("/usage/x", "/usage", true)).toBe(false);
    expect(matchesPath("/usage", "/usage?tab=1")).toBe(true);
  });
  it("treats / as exact only", () => {
    expect(resolveActiveItem(groups, "/")?.label).toBe("Tổng quan");
    expect(resolveActiveItem(groups, "/nothing")).toBeUndefined();
  });
  it("prefers the longest href", () => {
    expect(resolveActiveItem(groups, "/meetings/new")?.label).toBe("Họp mới");
    expect(resolveActiveItem(groups, "/meetings/42/minutes")?.label).toBe("Cuộc họp");
  });
  it("never activates disabled items; honours forced flags", () => {
    expect(resolveActiveItem(groups, "/soon")).toBeUndefined();
    const forced: NavGroup[] = [
      {
        items: [
          { label: "A", href: "/a", icon },
          { label: "B", href: "/b", icon, active: true },
        ],
      },
    ];
    expect(resolveActiveItem(forced, "/a")?.label).toBe("B");
  });
});
