import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildContentDisposition,
  exportMinutesDocx,
  exportMinutesMarkdownFile,
  parseExportFormat,
  parseExportMode,
  sanitizeTitle,
} from "./export-service";
import { ServiceError } from "./service-error";

const content = {
  summary: "Tóm tắt",
  topics: [],
  actionItems: [],
  openIssues: [],
};

let repos: Repositories;
const meetingWith = (title: string, langs: ("vi" | "en")[]) => {
  const m = repos.meetings.create({ title });
  for (const lang of langs) repos.minutes.upsert({ meetingId: m.id, lang, content, source: "ai" });
  return m.id;
};

beforeEach(() => {
  repos = createRepositories(openDatabase(IN_MEMORY));
});

describe("exportMinutesDocx", () => {
  it("exports vi with attachment headers", async () => {
    const id = meetingWith("Họp giá/Q4", ["vi"]);
    const res = await exportMinutesDocx(id, "vi", { repos });
    expect(res.buffer.subarray(0, 2).toString()).toBe("PK");
    expect(res.contentDisposition).toContain('filename="Hop gia Q4 (vi).docx"');
    expect(res.contentDisposition).toContain("filename*=UTF-8''H%E1%BB%8Dp%20gi%C3%A1%20Q4");
  });

  it("404 for unknown meeting", async () => {
    await expect(exportMinutesDocx("nope", "vi", { repos })).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("404 MINUTES_NOT_FOUND naming the missing language", async () => {
    const id = meetingWith("A", ["vi"]);
    const err = await exportMinutesDocx(id, "en", { repos }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceError);
    expect(err).toMatchObject({ status: 404, code: "MINUTES_NOT_FOUND" });
    expect((err as Error).message).toContain("tiếng Anh");
  });

  it("both requires both languages", async () => {
    const id = meetingWith("A", ["vi"]);
    await expect(exportMinutesDocx(id, "both", { repos })).rejects.toMatchObject({
      code: "MINUTES_NOT_FOUND",
      message: expect.stringContaining("tiếng Anh") as unknown as string,
    });
    const ok = meetingWith("B", ["vi", "en"]);
    expect((await exportMinutesDocx(ok, "both", { repos })).buffer.length).toBeGreaterThan(1000);
  });
});

describe("helpers", () => {
  it("sanitizes titles", () => {
    expect(sanitizeTitle('../a\\b:c*"d')).toBe("a b c d");
    expect(sanitizeTitle("///")).toBe("bien-ban-cuoc-hop");
  });
  it("keeps header ASCII-safe", () => {
    const h = buildContentDisposition("Đặt hàng “Q4”", "en");
    expect(/^[\x20-\x7e]+$/.test(h)).toBe(true);
    expect(h).toContain('filename="Dat hang Q4 (en).docx"');
  });
  it("parses mode", () => {
    expect(parseExportMode("both")).toBe("both");
    expect(parseExportMode("fr")).toBeNull();
    expect(parseExportMode(null)).toBeNull();
  });
});

describe("markdown export", () => {
  it("parses format with docx as default and rejects unknown values", () => {
    expect(parseExportFormat(null)).toBe("docx");
    expect(parseExportFormat("docx")).toBe("docx");
    expect(parseExportFormat("md")).toBe("md");
    expect(parseExportFormat("pdf")).toBeNull();
    expect(parseExportFormat("")).toBeNull();
  });

  it("builds an .md Content-Disposition", () => {
    const h = buildContentDisposition("Đặt hàng Q4", "vi", "md");
    expect(h).toContain('filename="Dat hang Q4 (vi).md"');
    expect(h).toContain("filename*=UTF-8''%C4%90%E1%BA%B7t%20h%C3%A0ng%20Q4%20%28vi%29.md");
    expect(buildContentDisposition("A", "vi")).toContain('filename="A (vi).docx"');
  });

  it("exports markdown text for a stored meeting", async () => {
    const id = meetingWith("Họp giá", ["vi"]);
    const res = await exportMinutesMarkdownFile(id, "vi", { repos });
    expect(res.body).toContain("# Họp giá");
    expect(res.body).toContain("Tóm tắt");
    expect(res.contentDisposition).toContain('filename="Hop gia (vi).md"');
  });

  it("404 for unknown meeting and missing language", async () => {
    await expect(exportMinutesMarkdownFile("nope", "vi", { repos })).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    const id = meetingWith("A", ["vi"]);
    await expect(exportMinutesMarkdownFile(id, "both", { repos })).rejects.toMatchObject({
      code: "MINUTES_NOT_FOUND",
    });
  });
});
