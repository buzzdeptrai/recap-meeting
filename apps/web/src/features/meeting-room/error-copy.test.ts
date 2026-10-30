import { describe, expect, it } from "vitest";
import { describeServerError } from "./error-copy";

describe("describeServerError", () => {
  it("explains in Vietnamese that another window took the meeting over", () => {
    const text = describeServerError({ type: "error", code: "SESSION_REPLACED", message: "x" });
    expect(text).toContain("cửa sổ khác");
    expect(text).not.toContain("Máy chủ ghi âm gặp lỗi");
  });
});
