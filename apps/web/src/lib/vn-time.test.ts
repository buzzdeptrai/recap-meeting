import { describe, expect, it } from "vitest";
import {
  dayHeading,
  formatVnTime,
  groupByDay,
  isDayKey,
  vnDayKey,
  vnDayStart,
  vnMonthStart,
  vnWeekStart,
} from "./vn-time";

// Thu 22/10/2026 12:00 in Ho Chi Minh (05:00Z)
const NOW = Date.parse("2026-10-22T05:00:00.000Z");

describe("vn-time", () => {
  it("assigns the Vietnam calendar day, not the UTC day", () => {
    expect(vnDayKey("2026-10-21T17:00:00.000Z")).toBe("2026-10-22");
    expect(vnDayKey("2026-10-21T16:59:59.999Z")).toBe("2026-10-21");
    expect(vnDayKey("nonsense")).toBe("");
  });

  it("computes day, week (Monday) and month starts", () => {
    expect(new Date(vnDayStart("2026-10-22")).toISOString()).toBe("2026-10-21T17:00:00.000Z");
    expect(new Date(vnWeekStart(NOW)).toISOString()).toBe("2026-10-18T17:00:00.000Z"); // Mon 19/10
    const sunday = Date.parse("2026-10-25T10:00:00.000Z"); // Sun 25/10 17:00 VN
    expect(vnDayKey(vnWeekStart(sunday))).toBe("2026-10-19");
    expect(vnDayKey(vnMonthStart(NOW))).toBe("2026-10-01");
  });

  it("validates day keys", () => {
    expect(isDayKey("2026-10-22")).toBe(true);
    expect(isDayKey("2026-02-31")).toBe(false);
    expect(isDayKey("22/10/2026")).toBe(false);
  });

  it("names day headings", () => {
    expect(dayHeading("2026-10-22", NOW)).toBe("Hôm nay");
    expect(dayHeading("2026-10-21", NOW)).toBe("Hôm qua");
    expect(dayHeading("2026-10-20", NOW)).toBe("Thứ Ba, 20/10/2026");
    expect(dayHeading("2026-10-18", NOW)).toBe("Chủ nhật, 18/10/2026");
  });

  it("groups consecutive meetings by day in input order", () => {
    const items = [
      { id: "a", at: "2026-10-22T04:00:00.000Z" },
      { id: "b", at: "2026-10-21T20:00:00.000Z" }, // 03:00 on 22/10 VN
      { id: "c", at: "2026-10-21T10:00:00.000Z" },
      { id: "d", at: "2026-10-10T10:00:00.000Z" },
    ];
    const groups = groupByDay(items, (i) => i.at, NOW);
    expect(groups.map((g) => [g.heading, g.items.map((i) => i.id)])).toEqual([
      ["Hôm nay", ["a", "b"]],
      ["Hôm qua", ["c"]],
      ["Thứ Bảy, 10/10/2026", ["d"]],
    ]);
  });

  it("formats the local time", () => {
    expect(formatVnTime("2026-10-22T05:07:00.000Z")).toBe("12:07");
    expect(formatVnTime("x")).toBe("—");
  });
});
