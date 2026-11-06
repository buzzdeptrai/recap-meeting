import { AuthService, createUpgradeAuthenticator, hashPassword } from "@recap/auth";
import { parseServerMessage, type ServerMessage } from "@recap/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createHarness, startMessage, type Harness } from "./helpers";

const SECRET = "access-test-secret-access-test-secret-1";
const SERVICE_TOKEN = "service-token-for-tests-123";
const PASSWORD = "correct horse battery";
const WAIT_MS = 2_000;

let harness: Harness;
const cookies: Record<string, string> = {};
const userIds: Record<string, string> = {};

beforeAll(async () => {
  const ref: { current?: ReturnType<typeof createUpgradeAuthenticator> } = {};
  harness = await createHarness(
    {},
    { authenticator: { authenticate: (h) => ref.current!.authenticate(h) } },
  );
  const { repos } = harness.deps;
  const auth = new AuthService({ repos, secret: SECRET });
  for (const [name, role] of [
    ["an", "member"],
    ["binh", "member"],
    ["admin", "admin"],
  ] as const) {
    const user = repos.users.create({
      email: `${name}@example.com`,
      name,
      role,
      passwordHash: await hashPassword(PASSWORD),
    });
    userIds[name] = user.id;
    const login = await auth.login({ email: user.email, password: PASSWORD, ip: "x" });
    if (!login.ok) throw new Error("login failed");
    cookies[name] = `recap_session=${login.cookieValue}`;
  }
  ref.current = createUpgradeAuthenticator(auth, SERVICE_TOKEN);
});
afterAll(async () => {
  await harness.close();
});

/** Connects, sends `start` for a meeting and resolves with the first ready/error answer. */
async function tryStart(headers: Record<string, string>, meetingId: string) {
  const socket = new WebSocket(`ws://localhost:${harness.port}/ws`, { headers });
  const messages: ServerMessage[] = [];
  socket.on("message", (data, isBinary) => {
    const parsed = isBinary ? null : parseServerMessage(data as Buffer);
    if (parsed?.ok) messages.push(parsed.message);
  });
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  socket.send(JSON.stringify(startMessage(meetingId)));
  const deadline = Date.now() + WAIT_MS;
  while (!messages.some((m) => m.type === "ready" || m.type === "error")) {
    if (Date.now() > deadline) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  socket.terminate();
  return messages.find((m) => m.type === "ready" || m.type === "error")!;
}

const meetingOf = (name: string | null) =>
  harness.deps.repos.meetings.create({ title: "Họp", ownerId: name ? userIds[name] : null }).id;

describe("start enforces meeting ownership", () => {
  it("answers a non-owner exactly like an unknown meeting", async () => {
    const meetingId = meetingOf("an");
    const denied = await tryStart({ cookie: cookies.binh! }, meetingId);
    const unknown = await tryStart({ cookie: cookies.binh! }, "no-such-meeting");
    expect(denied).toEqual({
      type: "error",
      code: "MEETING_NOT_FOUND",
      message: "Meeting not found",
    });
    expect(denied).toEqual(unknown);
    expect(harness.deps.registry.activeMeetingIds()).not.toContain(meetingId);
    expect(harness.deps.repos.meetings.get(meetingId)?.status).toBe("draft");
  });

  it("lets the owner, an admin and a service token start", async () => {
    expect((await tryStart({ cookie: cookies.an! }, meetingOf("an"))).type).toBe("ready");
    expect((await tryStart({ cookie: cookies.admin! }, meetingOf("an"))).type).toBe("ready");
    expect(
      (await tryStart({ authorization: `Bearer ${SERVICE_TOKEN}` }, meetingOf("an"))).type,
    ).toBe("ready");
  });

  it("keeps unowned meetings to admins and service tokens", async () => {
    const orphan = meetingOf(null);
    expect((await tryStart({ cookie: cookies.an! }, orphan)).type).toBe("error");
    expect((await tryStart({ cookie: cookies.admin! }, orphan)).type).toBe("ready");
    expect(
      (await tryStart({ authorization: `Bearer ${SERVICE_TOKEN}` }, meetingOf(null))).type,
    ).toBe("ready");
  });
});
