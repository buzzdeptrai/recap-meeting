import { describe, expect, it } from "vitest";
import { SESSION_ABSOLUTE_TTL_MS, SESSION_IDLE_TTL_MS, verifyPassword } from "../src";
import { PASSWORD, loginInput, setupAuth } from "./helpers";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

async function loggedIn() {
  const ctx = await setupAuth();
  const result = await ctx.auth.login(loginInput());
  if (!result.ok) throw new Error("login failed");
  return { ...ctx, result };
}

describe("AuthService login", () => {
  it("creates a session and a signed cookie for valid credentials", async () => {
    const { auth, result, repos, user } = await loggedIn();
    expect(result.user).toEqual({
      id: user.id,
      email: "an@example.com",
      name: "An",
      role: "member",
    });
    expect(result.cookieValue.startsWith(`${result.sessionId}.`)).toBe(true);
    expect(auth.getSessionUser(result.cookieValue)?.id).toBe(user.id);
    expect(repos.users.getById(user.id)?.lastLoginAt).not.toBeNull();
  });

  it("is case-insensitive on email and uses the injected random for session ids", async () => {
    const ctx = await setupAuth();
    const result = await ctx.auth.login(loginInput(PASSWORD, "  AN@Example.COM "));
    expect(result.ok && result.sessionId).toBe(Buffer.alloc(32, 1).toString("base64url"));
  });

  it("gives the same generic failure for wrong password and unknown user", async () => {
    const { auth } = await setupAuth();
    const wrong = await auth.login(loginInput("not the password"));
    const unknown = await auth.login(loginInput(PASSWORD, "ghost@example.com"));
    expect(wrong).toEqual({ ok: false, reason: "invalid" });
    expect(unknown).toEqual(wrong);
  });

  it("rejects disabled users even with the right password, and kills their sessions", async () => {
    const { auth, repos, user, result } = await loggedIn();
    repos.users.setDisabled(user.id, true);
    expect(auth.getSessionUser(result.cookieValue)).toBeNull();
    expect(await auth.login(loginInput())).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks after 5 failures for 15 minutes, even for the right password, then recovers", async () => {
    const { auth, advance } = await setupAuth();
    for (let i = 0; i < 5; i += 1) await auth.login(loginInput("bad password 1"));
    const locked = await auth.login(loginInput());
    expect(locked).toMatchObject({ ok: false, reason: "locked" });
    advance(14 * MIN);
    expect(await auth.login(loginInput())).toMatchObject({ reason: "locked" });
    advance(2 * MIN);
    expect((await auth.login(loginInput())).ok).toBe(true);
  });

  it("does not lock a different IP+email pair, but caps an email across IPs", async () => {
    const { auth } = await setupAuth();
    for (let i = 0; i < 5; i += 1)
      await auth.login(loginInput("bad password 1", "an@example.com", "9.9.9.9"));
    expect((await auth.login(loginInput())).ok).toBe(true);
    for (let i = 0; i < 20; i += 1) {
      await auth.login(loginInput("bad password 1", "an@example.com", `10.0.0.${i}`));
    }
    expect(await auth.login(loginInput(PASSWORD, "an@example.com", "10.9.9.9"))).toMatchObject({
      reason: "locked",
    });
  });
});

describe("AuthService sessions", () => {
  it("rejects tampered cookies", async () => {
    const { auth, result } = await loggedIn();
    expect(auth.authenticate(`${result.cookieValue}0`)).toBeNull();
    expect(auth.authenticate(`x${result.cookieValue}`)).toBeNull();
    expect(auth.authenticate(undefined)).toBeNull();
  });

  it("expires after the idle window and removes the row", async () => {
    const { auth, result, advance, repos } = await loggedIn();
    advance(SESSION_IDLE_TTL_MS + 1);
    expect(auth.authenticate(result.cookieValue)).toBeNull();
    expect(repos.sessions.get(result.sessionId)).toBeNull();
  });

  it("slides the expiry on activity but never past the absolute maximum", async () => {
    const { auth, result, advance, repos } = await loggedIn();
    for (let day = 0; day < 4; day += 1) {
      advance(5 * DAY);
      expect(auth.authenticate(result.cookieValue)).not.toBeNull();
    }
    const stored = repos.sessions.get(result.sessionId);
    expect(
      Date.parse(stored?.expiresAt ?? "") - Date.parse(stored?.createdAt ?? ""),
    ).toBeLessThanOrEqual(SESSION_ABSOLUTE_TTL_MS);
    advance(11 * DAY);
    expect(auth.authenticate(result.cookieValue)).toBeNull();
  });

  it("writes last_seen at most every few minutes", async () => {
    const { auth, result, advance, repos } = await loggedIn();
    const before = repos.sessions.get(result.sessionId)?.lastSeenAt;
    advance(MIN);
    auth.authenticate(result.cookieValue);
    expect(repos.sessions.get(result.sessionId)?.lastSeenAt).toBe(before);
    advance(6 * MIN);
    auth.authenticate(result.cookieValue);
    expect(repos.sessions.get(result.sessionId)?.lastSeenAt).not.toBe(before);
  });

  it("logout invalidates the session", async () => {
    const { auth, result } = await loggedIn();
    auth.logout(result.cookieValue);
    expect(auth.authenticate(result.cookieValue)).toBeNull();
    auth.logout("garbage");
  });
});

describe("AuthService password changes", () => {
  it("changes the password and signs out other sessions only", async () => {
    const { auth, result, user } = await loggedIn();
    const other = await auth.login(loginInput());
    if (!other.ok) throw new Error("login failed");
    const done = await auth.changePassword(
      user.id,
      result.sessionId,
      PASSWORD,
      "brand new password",
    );
    expect(done).toEqual({ ok: true });
    expect(auth.authenticate(result.cookieValue)).not.toBeNull();
    expect(auth.authenticate(other.cookieValue)).toBeNull();
    expect((await auth.login(loginInput("brand new password"))).ok).toBe(true);
  });

  it("refuses a wrong current password or a weak new one", async () => {
    const { auth, result, user, repos } = await loggedIn();
    expect(
      await auth.changePassword(user.id, result.sessionId, "wrong password", "brand new password"),
    ).toMatchObject({ ok: false });
    expect(await auth.changePassword(user.id, result.sessionId, PASSWORD, "short")).toMatchObject({
      ok: false,
    });
    expect(await verifyPassword(PASSWORD, repos.users.getById(user.id)?.passwordHash ?? "")).toBe(
      true,
    );
  });

  it("admin reset signs the user out everywhere", async () => {
    const { auth, result, user } = await loggedIn();
    const temp = auth.generateTempPassword();
    expect(temp.length).toBeGreaterThanOrEqual(10);
    await auth.resetPassword(user.id, temp);
    expect(auth.authenticate(result.cookieValue)).toBeNull();
    expect((await auth.login(loginInput(temp))).ok).toBe(true);
  });
});
