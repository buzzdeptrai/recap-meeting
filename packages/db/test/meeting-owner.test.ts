import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createRepositories, migrations, runMigrations } from "../src";
import { setup } from "./helpers";

const RANGE = { from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" };
const admin = { id: "admin", role: "admin" } as const;

function users(repos: ReturnType<typeof setup>["repos"]) {
  const make = (name: string, role: "admin" | "member") =>
    repos.users.create({ email: `${name}@x.test`, name, role, passwordHash: "h" });
  return { an: make("an", "member"), binh: make("binh", "member") };
}

describe("migration 015 owner backfill", () => {
  const OLD = migrations.filter((m) => m.version < 15);
  const oldDb = () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    runMigrations(db, OLD);
    return db;
  };
  const addUser = (db: Database.Database, id: string, role: string, createdAt: string) =>
    db
      .prepare(
        "INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, 'h', ?)",
      )
      .run(id, `${id}@x.test`, id, role, createdAt);
  const addMeeting = (db: Database.Database, id: string, deletedAt: string | null = null) =>
    db
      .prepare(
        "INSERT INTO meetings (id, title, status, created_at, deleted_at) VALUES (?, 't', 'ended', '2026-10-01T00:00:00Z', ?)",
      )
      .run(id, deletedAt);
  const owners = (db: Database.Database) =>
    db.prepare("SELECT id, owner_id AS owner FROM meetings ORDER BY id").all();

  it("gives every meeting, soft-deleted ones too, to the earliest-created admin", () => {
    const db = oldDb();
    addUser(db, "member-first", "member", "2026-01-01T00:00:00Z");
    addUser(db, "admin-late", "admin", "2026-03-01T00:00:00Z");
    addUser(db, "admin-early", "admin", "2026-02-01T00:00:00Z");
    addMeeting(db, "m1");
    addMeeting(db, "m2", "2026-10-02T00:00:00Z");
    expect(runMigrations(db)).toEqual([15]);
    expect(owners(db)).toEqual([
      { id: "m1", owner: "admin-early" },
      { id: "m2", owner: "admin-early" },
    ]);
  });

  it("breaks a created_at tie on insertion order, deterministically", () => {
    const db = oldDb();
    addUser(db, "zzz", "admin", "2026-02-01T00:00:00Z");
    addUser(db, "aaa", "admin", "2026-02-01T00:00:00Z");
    addMeeting(db, "m1");
    runMigrations(db);
    expect(owners(db)).toEqual([{ id: "m1", owner: "zzz" }]);
  });

  it("leaves the owner NULL when there is no admin", () => {
    const db = oldDb();
    addUser(db, "only-member", "member", "2026-01-01T00:00:00Z");
    addMeeting(db, "m1");
    runMigrations(db);
    expect(owners(db)).toEqual([{ id: "m1", owner: null }]);
  });

  it("creates the owner index and works on an empty database", () => {
    const db = oldDb();
    runMigrations(db);
    const index = db
      .prepare("SELECT name FROM sqlite_master WHERE name = 'idx_meetings_owner'")
      .get();
    expect(index).toBeDefined();
    expect(createRepositories(db).meetings.list()).toEqual([]);
  });
});

describe("owner scoping in the repositories", () => {
  function world() {
    const { repos, db } = setup();
    const { an, binh } = users(repos);
    const mk = (title: string, ownerId: string | null) => repos.meetings.create({ title, ownerId });
    const a1 = mk("Ngân sách A1", an.id);
    const a2 = mk("Ngân sách A2", an.id);
    const b1 = mk("Ngân sách B1", binh.id);
    const orphan = mk("Ngân sách mồ côi", null);
    for (const m of [a1, a2, b1, orphan]) {
      repos.segments.insert({
        meetingId: m.id,
        seq: 0,
        channel: 0,
        lang: "vi",
        startMs: 0,
        endMs: 1,
        text: "ngân sách",
      });
      repos.meetings.start(m.id);
      repos.meetings.end(m.id);
    }
    return {
      repos,
      db,
      an: { id: an.id, role: "member" } as const,
      binh: { id: binh.id, role: "member" } as const,
      a1,
      a2,
      b1,
      orphan,
    };
  }

  it("stores and returns ownerId; get ignores the viewer", () => {
    const { repos, a1, b1 } = world();
    expect(repos.meetings.get(a1.id)?.ownerId).toBe(a1.ownerId);
    expect(a1.ownerId).not.toBe(b1.ownerId);
  });

  it("scopes list, search results, total, counts and totals in SQL", () => {
    const { repos, an, a1, a2 } = world();
    const mine = repos.meetings.search({ viewer: an, limit: 1 });
    expect(mine.total).toBe(2);
    expect(mine.counts).toMatchObject({ all: 2, ended: 2 });
    expect(mine.totals.meetings).toBe(2);
    expect(mine.meetings).toHaveLength(1);
    const text = repos.meetings.search({ viewer: an, q: "ngan" });
    expect(text.meetings.map((m) => m.id).sort()).toEqual([a1.id, a2.id].sort());
    expect(repos.meetings.search({ viewer: admin, q: "ngan" }).total).toBe(4);
    expect(repos.meetings.search({ q: "ngan" }).total).toBe(4);
    expect(
      repos.meetings
        .list({ viewer: an })
        .map((m) => m.id)
        .sort(),
    ).toEqual([a1.id, a2.id].sort());
    expect(repos.meetings.list({ viewer: admin })).toHaveLength(4);
  });

  it("scopes the trash list and its total", () => {
    const { repos, an, a1, b1, orphan } = world();
    for (const m of [a1, b1, orphan]) repos.meetings.softDelete(m.id);
    const mine = repos.meetings.listDeleted({ viewer: an });
    expect(mine.meetings.map((m) => m.id)).toEqual([a1.id]);
    expect(mine.total).toBe(1);
    expect(repos.meetings.listDeleted({ viewer: admin }).total).toBe(3);
    expect(repos.meetings.getIncludingDeleted(a1.id)?.deletedAt).toBeTruthy();
  });

  it("scopes mark counts and the top-meetings usage ranking", () => {
    const { repos, an, a1, b1 } = world();
    repos.marks.insert({ meetingId: a1.id, kind: "conclusion", atMs: 1, label: null });
    repos.marks.insert({ meetingId: b1.id, kind: "conclusion", atMs: 1, label: null });
    const count = (viewer?: typeof an | typeof admin) =>
      repos.marks.countByKind("conclusion", "0000", "9999", viewer);
    expect(count()).toBe(2);
    expect(count(an)).toBe(1);
    expect(count(admin)).toBe(2);
    for (const m of [a1, b1]) {
      repos.usage.record({
        vendor: "openai",
        service: "minutes",
        model: "o",
        inputTokens: 5,
        outputTokens: 1,
        costUsd: 1,
        status: "ok",
        meetingId: m.id,
        ts: "2026-10-05T01:00:00Z",
      });
    }
    expect(repos.usage.topMeetings(RANGE, 5, an).map((r) => r.meetingId)).toEqual([a1.id]);
    expect(repos.usage.topMeetings(RANGE, 5, admin)).toHaveLength(2);
    expect(repos.usage.topMeetings(RANGE, 5)).toHaveLength(2);
  });

  it("picks the earliest admin as the default owner for tools", () => {
    const { repos } = setup();
    expect(repos.users.firstAdminId()).toBeNull();
    const first = repos.users.create({
      email: "a@x.test",
      name: "a",
      role: "admin",
      passwordHash: "h",
    });
    repos.users.create({ email: "b@x.test", name: "b", role: "admin", passwordHash: "h" });
    expect(repos.users.firstAdminId()).toBe(first.id);
  });
});
