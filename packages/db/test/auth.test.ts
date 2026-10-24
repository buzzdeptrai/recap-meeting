import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

const user = (email = "A@Example.com") => ({
  email,
  name: "An",
  role: "member" as const,
  passwordHash: "scrypt$x",
});

describe("users repository", () => {
  it("creates with lowercased email and finds case-insensitively", () => {
    const { repos } = setup();
    const created = repos.users.create(user());
    expect(created).toMatchObject({ email: "a@example.com", disabled: false, lastLoginAt: null });
    expect(repos.users.getByEmail("a@EXAMPLE.com")?.id).toBe(created.id);
    expect(repos.users.getById(created.id)?.name).toBe("An");
    expect(repos.users.getByEmail("nobody@example.com")).toBeNull();
  });

  it("rejects duplicate emails", () => {
    const { repos } = setup();
    repos.users.create(user());
    expect(() => repos.users.create(user("a@example.com"))).toThrow();
  });

  it("updates password, role, disabled, login time and counts active admins", () => {
    const { repos } = setup();
    const u = repos.users.create(user());
    repos.users.setPassword(u.id, "scrypt$y");
    repos.users.setRole(u.id, "admin");
    expect(repos.users.countActiveAdmins()).toBe(1);
    repos.users.setDisabled(u.id, true);
    repos.users.touchLogin(u.id);
    const after = repos.users.getById(u.id);
    expect(after).toMatchObject({ passwordHash: "scrypt$y", role: "admin", disabled: true });
    expect(after?.lastLoginAt).not.toBeNull();
    expect(repos.users.countActiveAdmins()).toBe(0);
    expect(repos.users.list()).toHaveLength(1);
  });
});

describe("sessions repository", () => {
  it("creates, gets, touches and deletes", () => {
    const { repos } = setup();
    const u = repos.users.create(user());
    const s = repos.sessions.create({
      id: "sess1",
      userId: u.id,
      expiresAt: "2026-10-28T00:00:00.000Z",
      userAgent: "UA",
    });
    expect(s).toMatchObject({ userId: u.id, userAgent: "UA" });
    repos.sessions.touch("sess1", "2026-10-29T00:00:00.000Z");
    expect(repos.sessions.get("sess1")?.expiresAt).toBe("2026-10-29T00:00:00.000Z");
    repos.sessions.delete("sess1");
    expect(repos.sessions.get("sess1")).toBeNull();
  });

  it("deletes per user, others-only, and expired", () => {
    const { repos } = setup();
    const u = repos.users.create(user());
    const w = repos.users.create(user("b@example.com"));
    const mk = (id: string, userId: string, expiresAt: string) =>
      repos.sessions.create({ id, userId, expiresAt });
    mk("a", u.id, "2026-10-21T08:00:00.000Z");
    mk("b", u.id, "2027-01-01T00:00:00.000Z");
    mk("c", u.id, "2027-01-01T00:00:00.000Z");
    mk("d", w.id, "2027-01-01T00:00:00.000Z");
    expect(repos.sessions.deleteExpired()).toBe(1);
    expect(repos.sessions.deleteOthersForUser(u.id, "b")).toBe(1);
    expect(repos.sessions.get("b")).not.toBeNull();
    expect(repos.sessions.deleteForUser(u.id)).toBe(1);
    expect(repos.sessions.get("d")).not.toBeNull();
  });

  it("cascades when the user is deleted", () => {
    const { repos, db } = setup();
    const u = repos.users.create(user());
    repos.sessions.create({ id: "s", userId: u.id, expiresAt: "2027-01-01T00:00:00.000Z" });
    db.prepare("DELETE FROM users WHERE id = ?").run(u.id);
    expect(repos.sessions.get("s")).toBeNull();
  });
});
