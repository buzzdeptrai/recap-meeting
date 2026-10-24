import { resolveActiveItem, type NavGroup } from "@recap/admin-ui";
import { describe, expect, it } from "vitest";
import { isRoomPath, NAV_SPEC } from "./nav";

const GROUPS: NavGroup[] = NAV_SPEC.map((g) => ({
  label: g.label,
  items: g.items.map((i) => ({ label: i.label, href: i.href, icon: null })),
}));
const activeHref = (path: string) => resolveActiveItem(GROUPS, path)?.href;

describe("nav active matching", () => {
  it("highlights each section", () => {
    expect(activeHref("/")).toBe("/");
    expect(activeHref("/usage")).toBe("/usage");
    expect(activeHref("/settings")).toBe("/settings");
    expect(activeHref("/glossary")).toBe("/glossary");
  });

  it("keeps Cuộc họp active for its sub pages", () => {
    expect(activeHref("/meetings")).toBe("/meetings");
    expect(activeHref("/meetings/new")).toBe("/meetings");
    expect(activeHref("/meetings/abc/minutes")).toBe("/meetings");
  });

  it("does not mark Tổng quan active on other pages, nor anything on unknown ones", () => {
    expect(activeHref("/usage")).not.toBe("/");
    expect(activeHref("/nope")).toBeUndefined();
  });
});

describe("isRoomPath", () => {
  it("is true only for the live room", () => {
    expect(isRoomPath("/meetings/9b2f")).toBe(true);
    expect(isRoomPath("/meetings/9b2f/")).toBe(true);
    expect(isRoomPath("/meetings")).toBe(false);
    expect(isRoomPath("/meetings/new")).toBe(false);
    expect(isRoomPath("/meetings/9b2f/minutes")).toBe(false);
    expect(isRoomPath("/usage")).toBe(false);
    expect(isRoomPath(null)).toBe(false);
  });
});
