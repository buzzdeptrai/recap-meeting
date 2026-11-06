import { AuthService, hashPassword } from "@recap/auth";
import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as listRoute, POST as createRoute } from "@/app/api/meetings/route";
import {
  DELETE as deleteRoute,
  GET as detailRoute,
  PATCH as patchRoute,
} from "@/app/api/meetings/[id]/route";
import { GET as exportRoute } from "@/app/api/meetings/[id]/export/route";
import { PATCH as markRoute } from "@/app/api/meetings/[id]/marks/[markId]/route";
import {
  GET as minutesRoute,
  POST as generateRoute,
  PUT as saveMinutesRoute,
} from "@/app/api/meetings/[id]/minutes/route";
import { GET as runRoute } from "@/app/api/meetings/[id]/minutes/run/route";
import { POST as translateRoute } from "@/app/api/meetings/[id]/minutes/translate/route";
import { GET as notesRoute, POST as addNoteRoute } from "@/app/api/meetings/[id]/notes/route";
import { PATCH as noteRoute } from "@/app/api/meetings/[id]/notes/[noteId]/route";
import { POST as restoreRoute } from "@/app/api/meetings/[id]/restore/route";
import { GET as searchRoute } from "@/app/api/meetings/[id]/search/route";
import { GET as segmentsRoute } from "@/app/api/meetings/[id]/segments/route";
import { GET as locateRoute } from "@/app/api/meetings/[id]/segments/locate/route";
import { GET as usageMeetingsRoute } from "@/app/api/usage/meetings/route";
import { GET as usageBreakdownRoute } from "@/app/api/usage/breakdown/route";
import { setAuthServiceForTests } from "./auth";

let repos: Repositories;
vi.mock("./db", () => ({ getRepositories: () => repos }));

const SECRET = "web-test-secret-web-test-secret-123456";
const PASSWORD = "correct horse battery";
type Who = "anh" | "binh" | "admin";
const cookies = {} as Record<Who, string>;
const ids = {} as Record<Who, string>;
let anhMeeting = "";
let binhMeeting = "";
let orphanMeeting = "";

async function makeUser(auth: AuthService, who: Who, role: "admin" | "member") {
  const user = repos.users.create({
    email: `${who}@example.com`,
    name: who,
    role,
    passwordHash: await hashPassword(PASSWORD),
  });
  const login = await auth.login({ email: user.email, password: PASSWORD, ip: "t" });
  if (!login.ok) throw new Error("login failed");
  ids[who] = user.id;
  cookies[who] = `recap_session=${login.cookieValue}`;
}

beforeEach(async () => {
  repos = createRepositories(openDatabase(IN_MEMORY));
  const auth = new AuthService({ repos, secret: SECRET });
  setAuthServiceForTests(auth);
  await makeUser(auth, "admin", "admin");
  await makeUser(auth, "anh", "member");
  await makeUser(auth, "binh", "member");
  anhMeeting = repos.meetings.create({ title: "Họp của Anh", ownerId: ids.anh }).id;
  binhMeeting = repos.meetings.create({ title: "Họp của Bình", ownerId: ids.binh }).id;
  orphanMeeting = repos.meetings.create({ title: "Họp không chủ" }).id;
  for (const id of [anhMeeting, binhMeeting]) {
    repos.meetings.start(id);
    repos.meetings.end(id);
  }
});
afterEach(() => setAuthServiceForTests(undefined));

type Handler = (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response>;
type Extra = { markId?: string; noteId?: string };

function call(who: Who, handler: unknown, id: string, init: RequestInit = {}, extra: Extra = {}) {
  const request = new Request("http://localhost:3000/api/x?lang=vi&q=a&atMs=0&format=md", {
    ...init,
    headers: { cookie: cookies[who], "content-type": "application/json" },
  });
  return (handler as (r: Request, c: unknown) => Promise<Response>)(request, {
    params: Promise.resolve({ id, ...extra }),
  });
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

describe("meeting ownership on /api/meetings/[id]/*", () => {
  const nested: Array<[string, Handler, RequestInit?, Extra?]> = [
    ["GET detail", detailRoute as Handler],
    ["PATCH detail", patchRoute as Handler, { method: "PATCH", body: '{"title":"x"}' }],
    ["DELETE detail", deleteRoute as Handler, { method: "DELETE" }],
    ["POST restore", restoreRoute as Handler, { method: "POST" }],
    ["GET segments", segmentsRoute as Handler],
    ["GET segments/locate", locateRoute as Handler],
    ["GET search", searchRoute as Handler],
    ["GET notes", notesRoute as Handler],
    ["POST notes", addNoteRoute as Handler, json({ content: "x" })],
    [
      "PATCH notes/:id",
      noteRoute as Handler,
      { method: "PATCH", body: '{"content":"x"}' },
      { noteId: "n" },
    ],
    [
      "PATCH marks/:id",
      markRoute as Handler,
      { method: "PATCH", body: '{"label":"x"}' },
      { markId: "k" },
    ],
    ["GET minutes", minutesRoute as Handler],
    ["POST minutes", generateRoute as Handler, json({ lang: "vi" })],
    ["PUT minutes", saveMinutesRoute as Handler, { method: "PUT", body: "{}" }],
    ["GET minutes/run", runRoute as Handler],
    ["POST minutes/translate", translateRoute as Handler, json({ lang: "en" })],
    ["GET export", exportRoute as Handler],
  ];

  it.each(nested)(
    "%s answers 404 NOT_FOUND to a member who does not own the meeting",
    async (_n, handler, init, extra) => {
      const res = await call("anh", handler, binhMeeting, init, extra);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: { code: "NOT_FOUND", message: expect.any(String) },
      });
      // Same answer as a meeting that does not exist: existence is not revealed.
      const unknown = await call("anh", handler, "no-such-meeting", init, extra);
      expect(unknown.status).toBe(404);
      expect(await unknown.json()).toEqual({
        error: { code: "NOT_FOUND", message: expect.any(String) },
      });
    },
  );

  it.each(nested)(
    "%s lets the owner and admins past the guard",
    async (_n, handler, init, extra) => {
      // A fake mark/note id may still 404 inside the handler; every other route must pass the guard.
      for (const who of ["anh", "admin"] as const) {
        const res = await call(who, handler, anhMeeting, init, extra);
        expect([401, 403]).not.toContain(res.status);
        if (res.status !== 404 || extra) continue;
        expect((await res.json()).error.code).not.toBe("NOT_FOUND");
      }
    },
  );

  it("does not let a member touch, rename, delete or restore another member's meeting", async () => {
    expect((await call("anh", patchRoute, binhMeeting, nested[1]![2])).status).toBe(404);
    expect((await call("anh", deleteRoute, binhMeeting, { method: "DELETE" })).status).toBe(404);
    expect(repos.meetings.get(binhMeeting)?.title).toBe("Họp của Bình");
    repos.meetings.softDelete(binhMeeting);
    expect((await call("anh", restoreRoute, binhMeeting, { method: "POST" })).status).toBe(404);
    expect(repos.meetings.get(binhMeeting)).toBeUndefined();
    expect((await call("binh", restoreRoute, binhMeeting, { method: "POST" })).status).toBe(200);
  });

  it("lets the owner read and an admin read and act on any meeting, including unowned ones", async () => {
    expect((await call("anh", detailRoute, anhMeeting)).status).toBe(200);
    expect((await call("admin", detailRoute, binhMeeting)).status).toBe(200);
    expect((await call("admin", detailRoute, orphanMeeting)).status).toBe(200);
    expect((await call("anh", detailRoute, orphanMeeting)).status).toBe(404);
    expect((await call("admin", deleteRoute, orphanMeeting, { method: "DELETE" })).status).toBe(
      200,
    );
  });
});

describe("meeting list, trash and create", () => {
  const list = async (who: Who, query = "") => {
    const res = await (listRoute as unknown as (r: Request, c: unknown) => Promise<Response>)(
      new Request(`http://localhost:3000/api/meetings${query}`, {
        headers: { cookie: cookies[who] },
      }),
      undefined,
    );
    return res.json();
  };

  it("lists only own meetings with matching total, counts and totals", async () => {
    const mine = await list("anh");
    expect(mine.meetings.map((m: { id: string }) => m.id)).toEqual([anhMeeting]);
    expect(mine.total).toBe(1);
    expect(mine.counts.all).toBe(1);
    expect(mine.totals.meetings).toBe(1);
    const paged = await list("anh", "?limit=1&offset=1");
    expect(paged.meetings).toEqual([]);
    expect(paged.total).toBe(1);
    expect((await list("admin")).total).toBe(3);
  });

  it("scopes the trash list and its total", async () => {
    repos.meetings.softDelete(anhMeeting);
    repos.meetings.softDelete(binhMeeting);
    const mine = await list("anh", "?deleted=1");
    expect(mine.meetings.map((m: { id: string }) => m.id)).toEqual([anhMeeting]);
    expect(mine.total).toBe(1);
    expect((await list("admin", "?deleted=1")).total).toBe(2);
  });

  it("scopes transcript search across meetings to the viewer", async () => {
    const seg = (meetingId: string) =>
      repos.segments.insert({
        meetingId,
        seq: 0,
        channel: 0,
        lang: "vi",
        startMs: 0,
        endMs: 1,
        text: "ngân sách quý",
      });
    seg(anhMeeting);
    seg(binhMeeting);
    const mine = await list("anh", "?q=ngan");
    expect(mine.meetings.map((m: { id: string }) => m.id)).toEqual([anhMeeting]);
    expect(mine.total).toBe(1);
    expect((await list("admin", "?q=ngan")).total).toBe(2);
  });

  it("stores the signed-in user as owner on create", async () => {
    const res = await (createRoute as unknown as (r: Request, c: unknown) => Promise<Response>)(
      new Request("http://localhost:3000/api/meetings", {
        method: "POST",
        headers: { cookie: cookies.anh, "content-type": "application/json" },
        body: JSON.stringify({ title: "Mới", sourceLang: "vi", targetLang: "en" }),
      }),
      undefined,
    );
    expect(res.status).toBe(201);
    const { meeting } = await res.json();
    expect(repos.meetings.get(meeting.id)?.ownerId).toBe(ids.anh);
  });
});

describe("/usage per-meeting rows", () => {
  const usage = (meetingId: string, cost: number) =>
    repos.usage.record({
      ts: "2026-10-21T09:00:00.000Z",
      vendor: "openai",
      model: "gpt",
      service: "minutes",
      meetingId,
      inputTokens: cost,
      outputTokens: 0,
      audioSeconds: 0,
      status: "ok",
    } as Parameters<typeof repos.usage.record>[0]);
  const query = "?from=2026-10-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z";
  const get = async (who: Who, handler: unknown, extra = "") => {
    const res = await (handler as (r: Request, c: unknown) => Promise<Response>)(
      new Request(`http://localhost:3000/api/usage/x${query}${extra}`, {
        headers: { cookie: cookies[who] },
      }),
      undefined,
    );
    return res.json();
  };

  it("hides other members' meeting titles from the top list and the meeting breakdown", async () => {
    usage(anhMeeting, 10);
    usage(binhMeeting, 20);
    const top = await get("anh", usageMeetingsRoute);
    expect(top.meetings.map((m: { title: string }) => m.title)).toEqual(["Họp của Anh"]);
    const breakdown = await get("anh", usageBreakdownRoute, "&groupBy=meeting");
    expect(breakdown.rows.map((r: { label: string }) => r.label)).toEqual(["Họp của Anh"]);
    expect(JSON.stringify(breakdown)).not.toContain("Bình");
    const all = await get("admin", usageMeetingsRoute);
    expect(all.meetings).toHaveLength(2);
  });
});
