import { describe, expect, it } from "vitest";
import {
  exportHref,
  exportOptions,
  hasAnyMinutes,
  NO_AVAILABILITY,
  withMinutes,
} from "./export-options";

const enabled = (vi: boolean, en: boolean) =>
  Object.fromEntries(exportOptions("m1", { vi, en }).map((o) => [o.mode, o.enabled]));

describe("exportOptions", () => {
  it("enables every option when both languages have minutes", () => {
    expect(enabled(true, true)).toEqual({ vi: true, en: true, both: true });
  });

  it("enables only the existing language and disables bilingual when one is missing", () => {
    expect(enabled(true, false)).toEqual({ vi: true, en: false, both: false });
    expect(enabled(false, true)).toEqual({ vi: false, en: true, both: false });
  });

  it("disables everything when there are no minutes", () => {
    expect(enabled(false, false)).toEqual({ vi: false, en: false, both: false });
    expect(hasAnyMinutes(NO_AVAILABILITY)).toBe(false);
  });

  it("explains which language is missing", () => {
    const [vi, en, both] = exportOptions("m1", { vi: true, en: false });
    expect(vi?.reason).toBeNull();
    expect(en?.reason).toBe("Chưa có biên bản tiếng Anh");
    expect(both?.reason).toBe("Chưa có biên bản tiếng Anh");
    expect(exportOptions("m1", NO_AVAILABILITY)[2]?.reason).toBe(
      "Chưa có biên bản tiếng Việt và tiếng Anh",
    );
  });

  it("links to the export endpoint with an encoded id", () => {
    expect(exportHref("a/b", "both")).toBe("/api/meetings/a%2Fb/export?lang=both");
    expect(exportOptions("m1", { vi: true, en: true })[0]?.href).toBe(
      "/api/meetings/m1/export?lang=vi",
    );
  });
});

describe("withMinutes", () => {
  it("adds a language without mutating and keeps identity when unchanged", () => {
    const start = { vi: true, en: false };
    expect(withMinutes(start, "en")).toEqual({ vi: true, en: true });
    expect(start.en).toBe(false);
    expect(withMinutes(start, "vi")).toBe(start);
  });
});

describe("markdown options", () => {
  it("adds format=md to the href and keeps the docx href unchanged", () => {
    expect(exportHref("m1", "both", "md")).toBe("/api/meetings/m1/export?lang=both&format=md");
    expect(exportHref("m1", "vi")).toBe("/api/meetings/m1/export?lang=vi");
  });

  it("builds md options with the same availability rules", () => {
    const opts = exportOptions("m1", { vi: true, en: false }, "md");
    expect(opts.map((o) => [o.mode, o.enabled, o.format])).toEqual([
      ["vi", true, "md"],
      ["en", false, "md"],
      ["both", false, "md"],
    ]);
    expect(opts[0]?.href).toContain("format=md");
  });
});
