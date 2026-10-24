import { describe, expect, it } from "vitest";
import { describeConfirm } from "./minutes-confirm";

const ctx = { lang: "en", sourceLang: "en", otherExists: true } as const;

describe("describeConfirm", () => {
  it("regenerate says the other language is translated again", () => {
    const copy = describeConfirm({ kind: "regenerate" }, ctx);
    expect(copy.description).toContain("bản tiếng Việt được dịch lại tự động");
    expect(copy.description).not.toContain("đang có sẽ bị thay");
  });

  it("warns when another source language replaces an existing version", () => {
    const copy = describeConfirm({ kind: "regenerate" }, { ...ctx, sourceLang: "vi" });
    expect(copy.description).toContain("Bản tiếng Việt đang có sẽ bị thay bằng biên bản mới");
    expect(copy.description).toContain("bản tiếng Anh được dịch lại");
  });

  it("re-translating over hand edits is a destructive, explicit confirm", () => {
    const copy = describeConfirm({ kind: "retranslate" }, ctx);
    expect(copy.destructive).toBe(true);
    expect(copy.description).toContain("chỉnh sửa của bạn sẽ mất");
  });
});
