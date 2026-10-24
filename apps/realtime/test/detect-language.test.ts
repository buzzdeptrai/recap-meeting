import { describe, expect, it } from "vitest";
import { detectLanguage } from "../src/translation/detect-language";

// Real AssemblyAI segments (lang NULL) from meeting f46f4b98.
const VIETNAMESE = [
  "bạn chế tạo được một loại nhiên liệu mới.",
  "Đối với tính mới thì công trình của bạn nên chứa đựng một thứ mà bạn là người đầu tư.",
  "tầm quan trọng và tính chính xác.",
  "nhưng cũng với loại gỗ đó.",
  "bởi vì nó giống như kiểu là bây giờ chúng ta",
  "đấy là mình chia thành ba dạng",
  "mà ai cũng đang cố gắng chạy",
];
const ENGLISH = [
  "Feel free to continue.",
  "Just, it's kind of what I've been preaching the whole time.",
  "I have to look at the spreadsheet.",
  "Atlassian is on that sheet.",
  "but we can't do that.",
  "don't think we can leave them off.",
  "bills itself as a platform.",
];

describe("detectLanguage", () => {
  it.each(VIETNAMESE)("classifies Vietnamese: %s", (text) => {
    expect(detectLanguage(text)).toBe("vi");
  });

  it.each(ENGLISH)("classifies English: %s", (text) => {
    expect(detectLanguage(text)).toBe("en");
  });

  it("handles NFD-normalised Vietnamese", () => {
    expect(detectLanguage("bạn chế tạo được một loại nhiên liệu mới".normalize("NFD"))).toBe("vi");
  });

  it("keeps mixed text conservative", () => {
    expect(detectLanguage("deadline là thứ Sáu")).toBe("vi"); // 3 of 4 words are Vietnamese
    expect(detectLanguage("we should ship the deadline là thứ Sáu")).toBe("unknown");
    expect(detectLanguage("the pipeline cho khách hàng is blocked")).toBe("unknown");
  });

  it.each([
    "",
    "   ",
    "OK",
    "Okay.",
    "Jaden",
    "Azure DevOps",
    "345",
    "1, 2, 3, 4",
    "Xin chào",
    "...",
  ])("returns unknown for short / non-text input: %j", (text) => {
    expect(detectLanguage(text)).toBe("unknown");
  });

  it("does not call unfamiliar Latin text English", () => {
    expect(detectLanguage("Jenkins CloudBees JFrog")).toBe("unknown");
    expect(detectLanguage("Bonjour tout le monde")).toBe("unknown");
  });
});
