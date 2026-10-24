import { describe, expect, it } from "vitest";
import { STALE_REASON_COPY, staleBannerText } from "./stale-copy";

describe("staleBannerText", () => {
  it("names every reason in plain Vietnamese", () => {
    expect(STALE_REASON_COPY.prompt_updated).toBe("Biên bản được tạo bằng phiên bản prompt cũ");
    expect(STALE_REASON_COPY.marks_removed).toBe("Đã xoá hoặc đổi dấu mốc sau khi tạo");
    for (const text of Object.values(STALE_REASON_COPY)) expect(text.length).toBeGreaterThan(10);
  });

  it("lists the reasons in order and ends with the call to action", () => {
    expect(staleBannerText(["transcript_changed", "prompt_updated"])).toBe(
      `${STALE_REASON_COPY.transcript_changed}; ${STALE_REASON_COPY.prompt_updated.toLowerCase()}. Tạo lại để cập nhật.`,
    );
    expect(staleBannerText(["model_changed"])).toBe(
      `${STALE_REASON_COPY.model_changed}. Tạo lại để cập nhật.`,
    );
  });

  it("offers a re-translation when the source changed", () => {
    expect(staleBannerText(["source_edited"])).toBe(
      "Bản gốc đã thay đổi sau lần dịch này. Dịch lại để cập nhật.",
    );
  });

  it("falls back to the generic copy without reasons", () => {
    expect(staleBannerText([])).toBe("Biên bản cũ hơn bản chép lời. Tạo lại để cập nhật.");
  });
});
