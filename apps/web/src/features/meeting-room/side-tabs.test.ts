import type { Mark } from "@recap/core";
import { describe, expect, it } from "vitest";
import { buildSideTabs, SIDE_TAB_IDS } from "./side-tabs";

const mark = (id: string, kind: Mark["kind"]): Mark => ({ id, kind, atMs: 0, label: null });

describe("buildSideTabs", () => {
  it("lists the four tabs in order", () => {
    expect(buildSideTabs([]).map((tab) => tab.id)).toEqual([...SIDE_TAB_IDS]);
  });

  it("counts topics and conclusions separately", () => {
    const tabs = buildSideTabs([mark("a", "topic"), mark("b", "conclusion"), mark("c", "topic")]);
    expect(tabs.find((tab) => tab.id === "topics")?.count).toBe(2);
    expect(tabs.find((tab) => tab.id === "conclusions")?.count).toBe(1);
  });

  it("shows zero counts instead of hiding the badge", () => {
    const tabs = buildSideTabs([]);
    expect(tabs[0]?.count).toBe(0);
    expect(tabs[1]?.count).toBe(0);
  });

  it("gives conclusions the decision count tone only", () => {
    const tabs = buildSideTabs([]);
    expect(tabs.find((tab) => tab.id === "conclusions")?.countTone).toBe("decision");
    expect(tabs.find((tab) => tab.id === "topics")?.countTone).toBeUndefined();
  });

  it("keeps Phiên without a count and disables Ghi chú with a reason", () => {
    const tabs = buildSideTabs([]);
    expect(tabs.find((tab) => tab.id === "session")?.count).toBeUndefined();
    const notes = tabs.find((tab) => tab.id === "notes");
    expect(notes?.disabled).toBe(true);
    expect(notes?.disabledReason).toBe("Sắp có");
  });
});
