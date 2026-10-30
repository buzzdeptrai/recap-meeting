import { AuthService, createUpgradeAuthenticator, hashPassword } from "@recap/auth";
import { parseServerMessage, type ServerMessage } from "@recap/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createHarness, startMessage, type Harness } from "./helpers";

const SECRET = "takeover-test-secret-takeover-test-secret";
const SERVICE_TOKEN = "service-token-for-tests-123";
const PASSWORD = "correct horse battery";
const WAIT_MS = 2_000;

let harness: Harness;
const cookies: Record<string, string> = {};

async function login(auth: AuthService, email: string): Promise<string> {
  const result = await auth.login({ email, password: PASSWORD, ip: "x" });
  if (!result.ok) throw new Error("login failed");
  return `recap_session=${result.cookieValue}`;
}

beforeAll(async () => {
  const authenticatorRef: { current?: ReturnType<typeof createUpgradeAuthenticator> } = {};
  harness = await createHarness(
    {},
    {
      authenticator: {
        authenticate: (headers) => authenticatorRef.current!.authenticate(headers),
      },
    },
  );
  const { repos } = harness.deps;
  for (const name of ["an", "binh"]) {
    repos.users.create({
      email: `${name}@example.com`,
      name,
      role: "member",
      passwordHash: await hashPassword(PASSWORD),
    });
  }
  const auth = new AuthService({ repos, secret: SECRET });
  cookies.an = await login(auth, "an@example.com");
  cookies.binh = await login(auth, "binh@example.com");
  authenticatorRef.current = createUpgradeAuthenticator(auth, SERVICE_TOKEN);
});
afterAll(async () => {
  await harness.close();
});

class Client {
  readonly messages: ServerMessage[] = [];
  private constructor(readonly socket: WebSocket) {
    socket.on("message", (data, isBinary) => {
      if (isBinary) return;
      const parsed = parseServerMessage(data as Buffer);
      if (parsed.ok) this.messages.push(parsed.message);
    });
  }
  static async connect(headers: Record<string, string>): Promise<Client> {
    const socket = new WebSocket(`ws://localhost:${harness.port}/ws`, { headers });
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    return new Client(socket);
  }
  start(meetingId: string): void {
    this.socket.send(JSON.stringify(startMessage(meetingId)));
  }
  async waitFor(predicate: (m: ServerMessage) => boolean): Promise<ServerMessage> {
    const deadline = Date.now() + WAIT_MS;
    for (;;) {
      const found = this.messages.find(predicate);
      if (found) return found;
      if (Date.now() > deadline) throw new Error(`Timed out: ${JSON.stringify(this.messages)}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  codes = () => this.messages.flatMap((m) => (m.type === "error" ? [m.code] : []));
  close = () => this.socket.terminate();
}

const newMeeting = () => harness.deps.repos.meetings.create({ title: "Takeover" }).id;

describe("resuming a meeting held by another connection", () => {
  it("lets the same user replace their own stale session", async () => {
    const meetingId = newMeeting();
    const stale = await Client.connect({ cookie: cookies.an! });
    stale.start(meetingId);
    await stale.waitFor((m) => m.type === "ready");

    const fresh = await Client.connect({ cookie: cookies.an! });
    fresh.start(meetingId);
    await fresh.waitFor((m) => m.type === "ready");

    expect(stale.codes()).toContain("SESSION_REPLACED");
    expect(fresh.codes()).toEqual([]);
    expect(harness.deps.registry.activeMeetingIds()).toEqual([meetingId]);

    // The stale socket going away later must not end the new session.
    stale.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(harness.deps.registry.activeMeetingIds()).toEqual([meetingId]);
    expect(harness.deps.repos.meetings.get(meetingId)?.status).toBe("live");
    fresh.close();
  });

  it("keeps refusing a different user", async () => {
    const meetingId = newMeeting();
    const owner = await Client.connect({ cookie: cookies.an! });
    owner.start(meetingId);
    await owner.waitFor((m) => m.type === "ready");

    const other = await Client.connect({ cookie: cookies.binh! });
    other.start(meetingId);
    await other.waitFor((m) => m.type === "error");
    expect(other.messages).toContainEqual({
      type: "error",
      code: "BAD_MESSAGE",
      message: "Meeting already has an active session",
    });
    expect(owner.codes()).toEqual([]);
    expect(harness.deps.registry.ownerOf(meetingId)?.userId).not.toBeNull();
    owner.close();
    other.close();
  });

  it("never lets a service-token connection take over", async () => {
    const meetingId = newMeeting();
    const owner = await Client.connect({ cookie: cookies.an! });
    owner.start(meetingId);
    await owner.waitFor((m) => m.type === "ready");

    const tool = await Client.connect({ authorization: `Bearer ${SERVICE_TOKEN}` });
    tool.start(meetingId);
    await tool.waitFor((m) => m.type === "error");
    expect(tool.codes()).toEqual(["BAD_MESSAGE"]);
    expect(owner.codes()).toEqual([]);
    owner.close();
    tool.close();
  });
});
