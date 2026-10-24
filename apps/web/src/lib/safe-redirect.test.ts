import { describe, expect, it } from "vitest";
import { loginUrl, safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/meetings/abc?x=1#y")).toBe("/meetings/abc?x=1#y");
    expect(safeNextPath("/")).toBe("/");
  });

  it("blocks open redirects", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\\/evil.example",
      "javascript:alert(1)",
      "evil.example",
      "/ok\r\nLocation: https://evil.example",
      "",
      null,
      undefined,
    ]) {
      expect(safeNextPath(bad as string | null | undefined)).toBe("/");
    }
  });

  it("never loops back to the login page", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/login?next=/x")).toBe("/");
  });

  it("builds the login URL with an encoded next", () => {
    expect(loginUrl("/meetings/1?a=b")).toBe("/login?next=%2Fmeetings%2F1%3Fa%3Db");
    expect(loginUrl("//evil.example")).toBe("/login");
    expect(loginUrl("/")).toBe("/login");
  });
});
