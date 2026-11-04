import { AuthService, hashPassword } from "@recap/auth";
import { EXTRA_INSTRUCTIONS_MAX } from "@recap/core";
import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createRoute } from "@/app/api/meetings/route";
import { GET as detailRoute, PATCH as patchRoute } from "@/app/api/meetings/[id]/route";
import { setAuthServiceForTests } from "./auth";
import { createMeetingSchema, patchMeetingSchema } from "./schemas";

let repos: Repositories;
vi.mock("./db", () => ({ getRepositories: () => repos }));

const SECRET = "web-test-secret-web-test-secret-123456";
const PASSWORD = "correct horse battery";
let cookie = "";

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
});
afterEach(() => setAuthServiceForTests(undefined));

type Handler = (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response>;

const send = (handler: Handler, method: string, body: unknown, id = "") =>
  handler(
    new Request("http://localhost:3000/api/meetings", {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

const base = { title: "Họp", sourceLang: "multi", targetLang: "vi" };

describe("meeting settings schemas", () => {
  it("accepts a known template and short instructions", () => {
    expect(
      createMeetingSchema.safeParse({ ...base, templateId: "client", extraInstructions: "ok" })
        .success,
    ).toBe(true);
  });

  it("rejects an unknown template and over-long instructions", () => {
    expect(createMeetingSchema.safeParse({ ...base, templateId: "nope" }).success).toBe(false);
    const tooLong = "x".repeat(EXTRA_INSTRUCTIONS_MAX + 1);
    expect(createMeetingSchema.safeParse({ ...base, extraInstructions: tooLong }).success).toBe(
      false,
    );
    expect(patchMeetingSchema.safeParse({ extraInstructions: tooLong }).success).toBe(false);
  });

  it("needs at least one field to patch and lets instructions be cleared", () => {
    expect(patchMeetingSchema.safeParse({}).success).toBe(false);
    expect(patchMeetingSchema.safeParse({ extraInstructions: null }).success).toBe(true);
  });
});

describe("create / patch meeting REST round trip", () => {
  it("creates with a template and instructions, and reads them back", async () => {
    const created = await send(createRoute, "POST", {
      ...base,
      templateId: "interview",
      extraInstructions: "  Chú ý điểm mạnh ",
    });
    expect(created.status).toBe(201);
    const { meeting } = await created.json();
    expect(meeting).toMatchObject({
      templateId: "interview",
      extraInstructions: "Chú ý điểm mạnh",
    });
    const detail = await detailRoute(
      new Request("http://localhost:3000/api/x", { headers: { cookie } }),
      { params: Promise.resolve({ id: meeting.id }) },
    );
    expect((await detail.json()).meeting).toMatchObject({ templateId: "interview" });
  });

  it("defaults to general when nothing is sent", async () => {
    const { meeting } = await (await send(createRoute, "POST", base)).json();
    expect(meeting).toMatchObject({ templateId: "general", extraInstructions: null });
  });

  it("answers 400 for an unknown template", async () => {
    expect((await send(createRoute, "POST", { ...base, templateId: "nope" })).status).toBe(400);
  });

  it("patches template and instructions without touching the title, and clears with null", async () => {
    const { meeting } = await (await send(createRoute, "POST", base)).json();
    const patched = await send(
      patchRoute,
      "PATCH",
      { templateId: "project", extraInstructions: "Liệt kê rủi ro" },
      meeting.id,
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).meeting).toMatchObject({
      title: "Họp",
      templateId: "project",
      extraInstructions: "Liệt kê rủi ro",
    });
    const cleared = await send(patchRoute, "PATCH", { extraInstructions: null }, meeting.id);
    expect((await cleared.json()).meeting).toMatchObject({
      templateId: "project",
      extraInstructions: null,
    });
    const renamed = await send(patchRoute, "PATCH", { title: "Mới" }, meeting.id);
    expect((await renamed.json()).meeting).toMatchObject({ title: "Mới", templateId: "project" });
  });

  it("rejects an invalid patch and answers 404 for an unknown meeting", async () => {
    const { meeting } = await (await send(createRoute, "POST", base)).json();
    expect((await send(patchRoute, "PATCH", { templateId: "x" }, meeting.id)).status).toBe(400);
    expect((await send(patchRoute, "PATCH", { templateId: "client" }, "nope")).status).toBe(404);
  });
});
