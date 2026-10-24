import { describe, expect, it } from "vitest";
import type { MinutesContent } from "@recap/core";
import { ExportError, exportMinutesMarkdown } from "../src";
import { EN, MEETING, VI } from "./helpers";

const EMPTY: MinutesContent = { summary: "Không có", topics: [], actionItems: [], openIssues: [] };

describe("exportMinutesMarkdown", () => {
  it("renders Vietnamese minutes with labels, timestamps, conclusion and action table", () => {
    const md = exportMinutesMarkdown({ meeting: MEETING, minutes: { vi: VI }, mode: "vi" });
    expect(md).toContain("# Họp giá Q4");
    expect(md).toContain("Biên bản cuộc họp");
    expect(md).toContain("## Tóm tắt");
    expect(md).toContain("## Nội dung thảo luận");
    expect(md).toContain("### Chính sách giá");
    expect(md).toContain("Đã thống nhất");
    expect(md).toContain("Còn bỏ ngỏ");
    expect(md).toContain("- Giảm giá 5% từ quý sau `[01:05]`");
    expect(md).toContain("> **Chốt mức 95 triệu đồng** `[02:05]`");
    expect(md).toContain("| Công việc | Phụ trách | Hạn |");
    expect(md).toContain("| Gửi báo giá mới `[02:10]` | Nguyễn Văn Ánh | 30/10 |");
    expect(md).toContain("## Vấn đề còn mở");
    expect(md).toContain("- Chưa rõ ngân sách tuyển dụng");
    expect(md).not.toContain("Pricing policy");
  });

  it("renders English labels", () => {
    const md = exportMinutesMarkdown({ meeting: MEETING, minutes: { en: EN }, mode: "en" });
    expect(md).toContain("## Summary");
    expect(md).toContain("### Pricing policy");
    expect(md).toContain("Dismissed");
    expect(md).toContain("> Settled on 95M");
    expect(md).toContain("## Action items");
    expect(md).not.toContain("Tóm tắt");
  });

  it("puts Vietnamese first then English, separated by a rule, in both mode", () => {
    const md = exportMinutesMarkdown({
      meeting: MEETING,
      minutes: { vi: VI, en: EN },
      mode: "both",
    });
    expect(md.indexOf("## Tóm tắt")).toBeLessThan(md.indexOf("## Summary"));
    expect(md).toContain("\n---\n");
  });

  it("handles empty sections", () => {
    const md = exportMinutesMarkdown({ meeting: MEETING, minutes: { vi: EMPTY }, mode: "vi" });
    expect(md).not.toContain("## Nội dung thảo luận");
    expect(md).not.toContain("## Vấn đề còn mở");
    expect(md).toContain("## Việc cần làm");
    expect(md).toContain("Không có");
    expect(md).not.toContain("| Công việc |");
  });

  it("escapes pipes and newlines inside table cells", () => {
    const content: MinutesContent = {
      ...EMPTY,
      actionItems: [{ id: "a", task: "A | B\nC", owner: null, due: null, atMs: null }],
    };
    const md = exportMinutesMarkdown({ meeting: MEETING, minutes: { vi: content }, mode: "vi" });
    expect(md).toContain("| A \\| B C | — | — |");
  });

  it("throws MISSING_MINUTES when a language is absent", () => {
    expect(() =>
      exportMinutesMarkdown({ meeting: MEETING, minutes: { vi: VI }, mode: "both" }),
    ).toThrow(ExportError);
  });
});
