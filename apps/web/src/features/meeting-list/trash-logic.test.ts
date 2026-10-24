import { describe, expect, it } from "vitest";
import { deleteBlockedReason, deleteDescription } from "./trash-logic";

describe("deleteBlockedReason", () => {
  it("blocks only a live meeting", () => {
    expect(deleteBlockedReason({ status: "live" })).toMatch(/dừng ghi/);
    expect(deleteBlockedReason({ status: "ended" })).toBeNull();
    expect(deleteBlockedReason({ status: "draft" })).toBeNull();
  });
});

describe("deleteDescription", () => {
  it("names the meeting and the place to restore from", () => {
    const text = deleteDescription("Họp giá");
    expect(text).toContain("“Họp giá”");
    expect(text).toContain("Đã xóa gần đây");
  });
});
