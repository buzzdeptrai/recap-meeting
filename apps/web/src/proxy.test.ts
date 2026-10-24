import { signSessionValue } from "@recap/auth";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const SECRET = "proxy-test-secret-proxy-test-secret-12";
vi.mock("@/server/auth-secret", () => ({ getAuthSecret: () => SECRET }));

const { proxy, config } = await import("./proxy");

const call = (path: string, cookie?: string) =>
  proxy(new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} }));

describe("proxy", () => {
  it("redirects unauthenticated pages to /login with an encoded next", () => {
    const response = call("/meetings/abc?x=1");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fmeetings%2Fabc%3Fx%3D1",
    );
    expect(call("/").headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("answers 401 JSON for unauthenticated API calls", async () => {
    const response = call("/api/meetings");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHENTICATED", message: expect.any(String) },
    });
  });

  it("lets public paths through", () => {
    for (const path of ["/login", "/api/auth/login", "/worklets/pcm-encoder.js"]) {
      expect(call(path).headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("rejects forged signatures and accepts a validly signed cookie", () => {
    expect(call("/", "recap_session=abc.forged").status).toBe(307);
    const good = `recap_session=${signSessionValue("abc", SECRET)}`;
    expect(call("/", good).headers.get("x-middleware-next")).toBe("1");
    expect(call("/api/meetings", good).headers.get("x-middleware-next")).toBe("1");
  });

  it("excludes Next internals and static assets via the matcher", () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`);
    expect(pattern.test("/_next/static/chunk.js")).toBe(false);
    expect(pattern.test("/logo.svg")).toBe(false);
    expect(pattern.test("/meetings/abc")).toBe(true);
    expect(pattern.test("/api/meetings")).toBe(true);
  });
});
