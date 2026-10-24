import { AuthService, hashPassword } from "@recap/auth";
import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as listRoute } from "@/app/api/meetings/route";
import { DELETE as deleteRoute, GET as detailRoute } from "@/app/api/meetings/[id]/route";
import { GET as segmentsRoute } from "@/app/api/meetings/[id]/segments/route";
import { POST as restoreRoute } from "@/app/api/meetings/[id]/restore/route";
import { setAuthServiceForTests } from "./auth";

let repos: Repositories;
vi.mock("./db", () => ({ getRepositories: () => repos }));

const SECRET = "web-test-secret-web-test-secret-123456";
const PASSWORD = "correct horse battery";
let cookie = "";
let meetingId = "";

beforeEach(async () => {
  repos = createRepositories(openDatabase(IN_MEMORY));
  const auth = new AuthService({ repos, secret: SECRET });
  setAuthServiceForTests(auth);
  repos.users.create({
    email: "m@example.com",
    name: "M",
    role: "member",
    passwordHash: await hashPassword(PASSWORD),
  });
  const login = await auth.login({ email: "m@example.com", password: PASSWORD, ip: "t" });
  if (!login.ok) throw new Error("login failed");
  cookie = `recap_session=${login.cookieValue}`;
  const meeting = repos.meetings.create({ title: "Họp A" });
  meetingId = meeting.id;
  repos.meetings.start(meetingId);
  repos.meetings.end(meetingId);
});
afterEach(() => setAuthServiceForTests(undefined));

type Handler = (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response>;

const call = (handler: Handler, method: string, id = meetingId, headers: HeadersInit = {}) =>
  handler(new Request("http://localhost:3000/api/x", { method, headers: { cookie, ...headers } }), {
    params: Promise.resolve({ id }),
  });

const list = async (query = "") => {
  const response = await listRoute(
    new Request(`http://localhost:3000/api/meetings${query}`, { headers: { cookie } }),
    undefined,
  );
  return response.json();
};

describe("soft delete REST routes", () => {
  it("requires a session and a same-origin request", async () => {
    const anon = await deleteRoute(
      new Request("http://localhost:3000/api/x", { method: "DELETE" }),
      {
        params: Promise.resolve({ id: meetingId }),
      },
    );
    expect(anon.status).toBe(401);
    const foreign = await call(deleteRoute, "DELETE", meetingId, { origin: "http://evil.test" });
    expect(foreign.status).toBe(403);
    expect(repos.meetings.get(meetingId)).toBeDefined();
  });

  it("deletes, then hides the meeting everywhere and answers 404 on direct access", async () => {
    const res = await call(deleteRoute, "DELETE");
    expect(res.status).toBe(200);
    expect((await res.json()).meeting.deletedAt).toBeTruthy();
    expect((await list()).total).toBe(0);
    expect((await call(detailRoute, "GET")).status).toBe(404);
    expect((await call(segmentsRoute, "GET")).status).toBe(404);
  });

  it("lists deleted meetings with ?deleted=1 and restores them", async () => {
    await call(deleteRoute, "DELETE");
    const deleted = await list("?deleted=1");
    expect(deleted.total).toBe(1);
    expect(deleted.meetings[0]).toMatchObject({ id: meetingId, title: "Họp A" });
    const restored = await call(restoreRoute, "POST");
    expect(restored.status).toBe(200);
    expect((await list()).total).toBe(1);
    expect((await list("?deleted=1")).total).toBe(0);
    expect((await call(detailRoute, "GET")).status).toBe(200);
  });

  it("is idempotent and answers 404 for unknown ids", async () => {
    expect((await call(deleteRoute, "DELETE")).status).toBe(200);
    expect((await call(deleteRoute, "DELETE")).status).toBe(200);
    expect((await call(restoreRoute, "POST")).status).toBe(200);
    expect((await call(restoreRoute, "POST")).status).toBe(200);
    expect((await call(deleteRoute, "DELETE", "nope")).status).toBe(404);
    expect((await call(restoreRoute, "POST", "nope")).status).toBe(404);
  });

  it("refuses a live meeting with 409 and a Vietnamese message", async () => {
    const live = repos.meetings.create({ title: "Đang ghi" });
    repos.meetings.start(live.id);
    const res = await call(deleteRoute, "DELETE", live.id);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: "MEETING_LIVE" });
    expect(repos.meetings.get(live.id)).toBeDefined();
  });
});
