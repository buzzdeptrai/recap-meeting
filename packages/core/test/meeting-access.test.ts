import { describe, expect, it } from "vitest";
import { canAccessMeeting, ownerRestriction } from "../src";

const admin = { id: "a", role: "admin" } as const;
const member = { id: "m", role: "member" } as const;

describe("canAccessMeeting", () => {
  it("lets an admin reach every meeting, owned by anyone or by nobody", () => {
    expect(canAccessMeeting(admin, "m")).toBe(true);
    expect(canAccessMeeting(admin, "other")).toBe(true);
    expect(canAccessMeeting(admin, null)).toBe(true);
  });

  it("lets a member reach only their own meetings, never an unowned one", () => {
    expect(canAccessMeeting(member, "m")).toBe(true);
    expect(canAccessMeeting(member, "other")).toBe(false);
    expect(canAccessMeeting(member, null)).toBe(false);
  });
});

describe("ownerRestriction", () => {
  it("restricts members to their id and leaves admins and internal callers unrestricted", () => {
    expect(ownerRestriction(member)).toBe("m");
    expect(ownerRestriction(admin)).toBeNull();
    expect(ownerRestriction(undefined)).toBeNull();
  });
});
