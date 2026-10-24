import { AuthService, createUpgradeAuthenticator, hashPassword } from "@recap/auth";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createRealtimeServer } from "../src/app";
import { createHarness, type Harness } from "./helpers";

const SECRET = "realtime-test-secret-realtime-test-secret";
const SERVICE_TOKEN = "service-token-for-tests-123";
const PASSWORD = "correct horse battery";

let harness: Harness;
let auth: AuthService;
let cookie = "";
let userId = "";
let now = Date.parse("2026-10-22T00:00:00.000Z");
let port = 0;
let server: ReturnType<typeof createRealtimeServer>;

beforeAll(async () => {
  harness = await createHarness();
  const { repos } = harness.deps;
  const user = repos.users.create({
    email: "an@example.com",
    name: "An",
    role: "member",
    passwordHash: await hashPassword(PASSWORD),
  });
  userId = user.id;
  auth = new AuthService({ repos, secret: SECRET, clock: () => now });
  const login = await auth.login({ email: "an@example.com", password: PASSWORD, ip: "x" });
  if (!login.ok) throw new Error("login failed");
  cookie = `recap_session=${login.cookieValue}`;
  server = createRealtimeServer(harness.deps, {
    authenticator: createUpgradeAuthenticator(auth, SERVICE_TOKEN),
  });
  port = await server.listen(0);
});
afterAll(async () => {
  await server.close();
  await harness.close();
});

function attempt(headers: Record<string, string>): Promise<number> {
  return new Promise((resolve) => {
    const socket = new WebSocket(`ws://localhost:${port}/ws`, { headers });
    socket.once("open", () => {
      socket.close();
      resolve(101);
    });
    socket.once("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
    socket.once("error", () => resolve(0));
  });
}

describe("websocket upgrade authentication", () => {
  it("accepts a valid session cookie", async () => {
    expect(await attempt({ cookie })).toBe(101);
  });

  it("answers 401 without credentials", async () => {
    expect(await attempt({})).toBe(401);
  });

  it("answers 401 for a tampered cookie", async () => {
    expect(await attempt({ cookie: `${cookie}x` })).toBe(401);
  });

  it("accepts the service token and rejects a wrong one", async () => {
    expect(await attempt({ authorization: `Bearer ${SERVICE_TOKEN}` })).toBe(101);
    expect(await attempt({ authorization: "Bearer nope" })).toBe(401);
  });

  it("keeps the origin allow-list ahead of auth", async () => {
    expect(await attempt({ cookie, origin: "https://evil.example" })).toBe(403);
    expect(await attempt({ cookie, origin: "http://localhost:3000" })).toBe(101);
  });

  it("rejects disabled users, then expired sessions", async () => {
    harness.deps.repos.users.setDisabled(userId, true);
    expect(await attempt({ cookie })).toBe(401);
    harness.deps.repos.users.setDisabled(userId, false);
    expect(await attempt({ cookie })).toBe(101);
    now += 8 * 24 * 60 * 60 * 1000;
    expect(await attempt({ cookie })).toBe(401);
  });
});
