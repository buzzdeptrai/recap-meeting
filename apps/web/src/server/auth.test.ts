import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { AuthService, hashPassword } from "@recap/auth";
import { IN_MEMORY, createRepositories, openDatabase } from "@recap/db";
import { afterEach, describe, expect, it } from "vitest";
import { clientIp, isSecureRequest, setAuthServiceForTests, withAuth } from "./auth";

const SECRET = "web-test-secret-web-test-secret-123456";
const PASSWORD = "correct horse battery";

async function setup() {
  const repos = createRepositories(openDatabase(IN_MEMORY));
  const auth = new AuthService({ repos, secret: SECRET });
  setAuthServiceForTests(auth);
  const passwordHash = await hashPassword(PASSWORD);
  const member = repos.users.create({
    email: "m@example.com",
    name: "M",
    role: "member",
    passwordHash,
  });
  const admin = repos.users.create({
    email: "a@example.com",
    name: "A",
    role: "admin",
    passwordHash,
  });
  const cookieFor = async (email: string) => {
    const result = await auth.login({ email, password: PASSWORD, ip: "t" });
    if (!result.ok) throw new Error("login failed");
    return `recap_session=${result.cookieValue}`;
  };
  return { repos, member, admin, cookieFor };
}

const request = (cookie?: string) =>
  new Request("http://localhost:3000/api/x", { headers: cookie ? { cookie } : {} });

afterEach(() => setAuthServiceForTests(undefined));

describe("withAuth", () => {
  const handler = withAuth((_req, _ctx, session) => Response.json({ id: session.user.id }));
  const adminHandler = withAuth(() => Response.json({ ok: true }), { admin: true });

  it("answers 401 in the standard error format without a session", async () => {
    await setup();
    const response = await handler(request(), undefined);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHENTICATED", message: expect.any(String) },
    });
    expect((await handler(request("recap_session=forged.sig"), undefined)).status).toBe(401);
  });

  it("passes the session to the handler", async () => {
    const { cookieFor, member } = await setup();
    const response = await handler(request(await cookieFor("m@example.com")), undefined);
    expect(await response.json()).toEqual({ id: member.id });
  });

  it("rejects members on admin routes with 403 and lets admins in", async () => {
    const { cookieFor } = await setup();
    expect((await adminHandler(request(await cookieFor("m@example.com")), undefined)).status).toBe(
      403,
    );
    expect((await adminHandler(request(await cookieFor("a@example.com")), undefined)).status).toBe(
      200,
    );
  });

  it("rejects disabled users and revoked sessions even with a valid signature", async () => {
    const { cookieFor, repos, member } = await setup();
    const cookie = await cookieFor("m@example.com");
    repos.users.setDisabled(member.id, true);
    expect((await handler(request(cookie), undefined)).status).toBe(401);
    repos.users.setDisabled(member.id, false);
    repos.sessions.deleteForUser(member.id);
    expect((await handler(request(cookie), undefined)).status).toBe(401);
  });
});

describe("request helpers", () => {
  it("detects https and ignores forwarded IPs unless trusted", () => {
    expect(isSecureRequest(new Request("https://x.example/a"))).toBe(true);
    expect(isSecureRequest(new Request("http://x.example/a"))).toBe(false);
    expect(
      isSecureRequest(
        new Request("http://x.example/a", { headers: { "x-forwarded-proto": "https" } }),
      ),
    ).toBe(true);
    const spoofed = new Request("http://x.example/a", {
      headers: { "x-forwarded-for": "6.6.6.6" },
    });
    expect(clientIp(spoofed)).toBe("direct");
  });
});

/** Guard against a new API route that forgets authentication. */
describe("API route coverage", () => {
  const PUBLIC_ROUTES = new Set(["auth/login/route.ts", "auth/logout/route.ts"]);
  const apiDir = join(__dirname, "..", "app", "api");

  function routeFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return routeFiles(full);
      return name === "route.ts" ? [full] : [];
    });
  }

  it("wraps every handler in withAuth except login/logout", () => {
    for (const file of routeFiles(apiDir)) {
      const rel = file.slice(apiDir.length + 1).replaceAll("\\", "/");
      if (PUBLIC_ROUTES.has(rel)) continue;
      const source = readFileSync(file, "utf8");
      const handlers = source.match(/export (?:async )?function (?:GET|POST|PUT|PATCH|DELETE)\b/g);
      expect(handlers, `${rel} exports a bare handler`).toBeNull();
      expect(source, `${rel} must use withAuth`).toMatch(
        /export const (GET|POST|PUT|PATCH|DELETE) = withAuth\(/,
      );
    }
  });
});
