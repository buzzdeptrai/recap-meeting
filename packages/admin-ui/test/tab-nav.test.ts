import { describe, expect, it } from "vitest";
import { isTabNavKey, nextTabIndex, resolveSelectedTab } from "../src";

describe("nextTabIndex", () => {
  const none = [false, false, false, false];
  it("moves and wraps with arrow keys", () => {
    expect(nextTabIndex(none, 0, "ArrowRight")).toBe(1);
    expect(nextTabIndex(none, 3, "ArrowRight")).toBe(0);
    expect(nextTabIndex(none, 0, "ArrowLeft")).toBe(3);
    expect(nextTabIndex(none, 2, "ArrowDown")).toBe(3);
    expect(nextTabIndex(none, 2, "ArrowUp")).toBe(1);
  });

  it("skips disabled tabs", () => {
    const disabled = [false, false, false, true];
    expect(nextTabIndex(disabled, 2, "ArrowRight")).toBe(0);
    expect(nextTabIndex(disabled, 0, "ArrowLeft")).toBe(2);
    expect(nextTabIndex([true, false, true, false], 1, "ArrowRight")).toBe(3);
  });

  it("Home and End jump to the first and last enabled tab", () => {
    const disabled = [true, false, false, true];
    expect(nextTabIndex(disabled, 2, "Home")).toBe(1);
    expect(nextTabIndex(disabled, 1, "End")).toBe(2);
  });

  it("stays put when it is the only enabled tab and reports -1 when none is enabled", () => {
    expect(nextTabIndex([false, true], 0, "ArrowRight")).toBe(0);
    expect(nextTabIndex([true, true], 0, "ArrowRight")).toBe(-1);
    expect(nextTabIndex([], 0, "Home")).toBe(-1);
  });

  it("recognises only navigation keys", () => {
    expect(isTabNavKey("ArrowLeft")).toBe(true);
    expect(isTabNavKey("Enter")).toBe(false);
  });
});

describe("resolveSelectedTab", () => {
  const tabs = [{ id: "a", disabled: true }, { id: "b" }, { id: "c" }];
  it("uses the given value when enabled, else the first enabled tab", () => {
    expect(resolveSelectedTab(tabs, "c")).toBe("c");
    expect(resolveSelectedTab(tabs, "a")).toBe("b");
    expect(resolveSelectedTab(tabs, undefined)).toBe("b");
    expect(resolveSelectedTab([{ id: "x", disabled: true }], "x")).toBeUndefined();
  });
});
