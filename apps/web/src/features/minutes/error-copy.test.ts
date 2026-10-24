import { describe, expect, it } from "vitest";
import { describeMinutesError, MinutesApiError } from "./error-copy";

const err = (status: number) => new MinutesApiError(status, "X", "m");

describe("describeMinutesError", () => {
  it("maps generate statuses to specific Vietnamese messages", () => {
    expect(describeMinutesError("generate", err(409))).toContain("chưa kết thúc");
    expect(describeMinutesError("generate", err(422))).toContain("chưa có nội dung");
    expect(describeMinutesError("generate", err(502))).toContain("thử lại");
    expect(describeMinutesError("generate", err(503))).toContain("cấu hình");
  });

  it("reports network failures and unknown errors", () => {
    expect(describeMinutesError("save", err(0))).toContain("kết nối");
    expect(describeMinutesError("save", new Error("x"))).toContain("Chưa lưu được");
    expect(describeMinutesError("generate", err(500))).toContain("Không tạo được");
  });

  it("explains a rejected save", () => {
    expect(describeMinutesError("save", err(400))).toContain("không hợp lệ");
  });
});
