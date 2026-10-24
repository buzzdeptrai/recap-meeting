import { AuthService, hashPassword } from "@recap/auth";
import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getSegments } from "@/app/api/meetings/[id]/segments/route";
import { GET as getLocate } from "@/app/api/meetings/[id]/segments/locate/route";
import { GET as getSearch } from "@/app/api/meetings/[id]/search/route";
import { setAuthServiceForTests } from "./auth";
import { getMeetingDetail } from "./meetings-service";

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
  meetingId = repos.meetings.create({ title: "Họp dài" }).id;
  for (let seq = 0; seq < 30; seq++) {
    const s = repos.segments.insert({
      meetingId,
      seq,
      channel: 0,
      lang: "vi",
      startMs: seq * 1000,
      endMs: seq * 1000 + 900,
      text: `ngân sách số ${seq}`,
    });
    repos.translations.upsert({
      segmentId: s.id,
      lang: "en",
      text: `budget ${seq}`,
      provider: "p",
      latencyMs: 1,
    });
  }
});
afterEach(() => setAuthServiceForTests(undefined));

const call = (
  handler: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response>,
  path: string,
  id = meetingId,
  withCookie = true,
) =>
  handler(
    new Request(`http://localhost:3000/api/x${path}`, { headers: withCookie ? { cookie } : {} }),
    {
      params: Promise.resolve({ id }),
    },
  );

describe("transcript REST routes", () => {
  it("answers 401 without a session on all three", async () => {
    for (const [handler, path] of [
      [getSegments, ""],
      [getLocate, "?atMs=1"],
      [getSearch, "?q=a"],
    ] as const) {
      expect((await call(handler, path, meetingId, false)).status).toBe(401);
    }
  });

  it("answers 404 for an unknown meeting", async () => {
    expect((await call(getSegments, "", "nope")).status).toBe(404);
    expect((await call(getLocate, "?atMs=1", "nope")).status).toBe(404);
    expect((await call(getSearch, "?q=a", "nope")).status).toBe(404);
  });

  it("pages with cursors and returns only those segments' translations", async () => {
    const first = await (await call(getSegments, "?limit=10")).json();
    expect(first.segments).toHaveLength(10);
    expect(first.translations.map((t: { segmentId: string }) => t.segmentId).sort()).toEqual(
      first.segments.map((s: { id: string }) => s.id).sort(),
    );
    expect(first).toMatchObject({ nextCursor: 10, prevCursor: null, total: 30 });
    const back = await (await call(getSegments, "?dir=backward&limit=10")).json();
    expect(back.segments.map((s: { seq: number }) => s.seq)[0]).toBe(20);
    expect(back).toMatchObject({ nextCursor: null, prevCursor: 20 });
  });

  it("clamps the limit and rejects junk", async () => {
    const big = await (await call(getSegments, "?limit=99999")).json();
    expect(big.segments).toHaveLength(30);
    expect((await call(getSegments, "?limit=abc")).status).toBe(400);
    expect((await call(getSegments, "?dir=sideways")).status).toBe(400);
    expect((await call(getSegments, "?from=-1")).status).toBe(400);
  });

  it("locates by time and by seq, 400 without or with both, 404 for an empty meeting", async () => {
    const at = await (await call(getLocate, "?atMs=15500&limit=10")).json();
    expect(at).toMatchObject({ seq: 15, from: 10 });
    expect((await (await call(getLocate, "?seq=3")).json()).seq).toBe(3);
    expect((await call(getLocate, "")).status).toBe(400);
    expect((await call(getLocate, "?atMs=1&seq=2")).status).toBe(400);
    const empty = repos.meetings.create({ title: "trống" }).id;
    expect((await call(getLocate, "?atMs=1", empty)).status).toBe(404);
  });

  it("searches diacritics-insensitively with a limit and escaped snippets", async () => {
    const res = await (await call(getSearch, "?q=ngan%20sach%207&limit=5")).json();
    expect(res.hits).toHaveLength(1);
    expect(res.hits[0]).toMatchObject({ seq: 7, startMs: 7000 });
    expect(res.hits[0].snippet).toContain("<mark>ngân</mark>");
    const many = await (await call(getSearch, "?q=ngan&limit=5")).json();
    expect(many.hits).toHaveLength(5);
    expect(many.truncated).toBe(true);
    expect((await (await call(getSearch, "?q=")).json()).hits).toEqual([]);
  });
});

describe("getMeetingDetail pages", () => {
  it("sends the head page for an ended meeting, the tail for a live one, the page around ?t", () => {
    repos.meetings.start(meetingId);
    expect(getMeetingDetail(meetingId, { pageSize: 10 })?.page.segments[0]?.seq).toBe(20);
    repos.meetings.end(meetingId);
    const head = getMeetingDetail(meetingId, { pageSize: 10 });
    expect(head?.page.segments[0]?.seq).toBe(0);
    expect(head?.page.translations).toHaveLength(10);
    expect(head?.stats.segments).toBe(30);
    const around = getMeetingDetail(meetingId, { aroundMs: 20_000, pageSize: 10 });
    expect(around?.page.segments.map((s) => s.seq)).toContain(20);
    expect(getMeetingDetail("nope")).toBeUndefined();
  });

  it("anchors conclusion marks on their segment", () => {
    const mark = repos.marks.insert({ meetingId, kind: "conclusion", atMs: 12_300, label: null });
    const detail = getMeetingDetail(meetingId);
    expect(detail?.markAnchors[mark.id]).toMatchObject({ seq: 12 });
  });
});
