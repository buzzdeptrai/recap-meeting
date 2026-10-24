import { describe, expect, it } from "vitest";
import { buildMinutesDocx, ExportError } from "../src";
import { formatDuration, formatOffset } from "../src/format";
import { EN, MEETING, VI, documentXml, readZipEntries } from "./helpers";

const text = (xml: string) => xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("buildMinutesDocx", () => {
  it("produces a valid docx zip with Vietnamese content", async () => {
    const buf = await buildMinutesDocx({ meeting: MEETING, minutes: { vi: VI }, mode: "vi" });
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    const entries = readZipEntries(buf);
    expect(entries.has("[Content_Types].xml")).toBe(true);
    const t = text(documentXml(buf));
    for (const s of [
      "Họp giá Q4",
      "Chính sách giá",
      "ĐÃ CHỐT",
      "CHƯA CHỐT",
      "Chốt mức 95 triệu đồng",
      "[01:05]",
      "[02:05]",
      "Nguyễn Văn Ánh",
      "Công việc",
      "Phụ trách",
      "Hạn",
      "Chưa rõ ngân sách tuyển dụng",
      "Vấn đề còn mở",
    ]) {
      expect(t).toContain(s);
    }
    expect(t).not.toContain("Pricing policy");
  });

  it("uses A4 page size, shaded callout and an action table", async () => {
    const xml = documentXml(
      await buildMinutesDocx({ meeting: MEETING, minutes: { vi: VI }, mode: "vi" }),
    );
    expect(xml).toContain('w:w="11906"');
    expect(xml).toContain("FFF4D6");
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain('w:eastAsia="Calibri"');
  });

  it("renders English labels", async () => {
    const t = text(
      documentXml(await buildMinutesDocx({ meeting: MEETING, minutes: { en: EN }, mode: "en" })),
    );
    expect(t).toContain("REJECTED");
    expect(t).toContain("Meeting minutes".toUpperCase());
    expect(t).toContain("None");
  });

  it("both mode puts VI before EN in two sections with page footers", async () => {
    const buf = await buildMinutesDocx({
      meeting: MEETING,
      minutes: { vi: VI, en: EN },
      mode: "both",
    });
    const xml = documentXml(buf);
    expect(xml.indexOf("Chính sách giá")).toBeLessThan(xml.indexOf("Pricing policy"));
    expect(xml.match(/<w:sectPr/g)?.length).toBe(2);
    const files = [...readZipEntries(buf).keys()];
    expect(files.some((f) => f.startsWith("word/footer"))).toBe(true);
  });

  it("throws when a requested language is missing", async () => {
    await expect(
      buildMinutesDocx({ meeting: MEETING, minutes: { vi: VI }, mode: "both" }),
    ).rejects.toBeInstanceOf(ExportError);
  });
});

describe("format helpers", () => {
  it("formats offsets and durations", () => {
    expect(formatOffset(65_000)).toBe("01:05");
    expect(formatOffset(3_725_000)).toBe("01:02:05");
    expect(formatDuration(4_500_000, "vi")).toBe("1 giờ 15 phút");
    expect(formatDuration(null, "en")).toBe("—");
  });
});
