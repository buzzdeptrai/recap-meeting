import { describe, expect, it } from "vitest";
import { createUpgradeAuthenticator, signSessionValue, SESSION_IDLE_TTL_MS } from "../src";
import { SECRET, loginInput, setupAuth } from "./helpers";

async function setup(serviceToken?: string) {
  const ctx = await setupAuth();
  const login = await ctx.auth.login(loginInput());
  if (!login.ok) throw new Error("login failed");
  return { ...ctx, login, ws: createUpgradeAuthenticator(ctx.auth, serviceToken) };
}

describe("upgrade authenticator", () => {
  it("accepts a valid cookie", async () => {
    const { ws, login } = await setup();
    const result = ws.authenticate({ cookie: `x=1; recap_session=${login.cookieValue}` });
    expect(result).toMatchObject({ ok: true, kind: "user" });
  });

  it("rejects missing, tampered, forged and unknown-session cookies", async () => {
    const { ws, login } = await setup();
    expect(ws.authenticate({})).toEqual({ ok: false });
    expect(ws.authenticate({ cookie: `recap_session=${login.cookieValue}z` })).toEqual({
      ok: false,
    });
    expect(
      ws.authenticate({ cookie: `recap_session=${signSessionValue("nope", `${SECRET}x`)}` }),
    ).toEqual({ ok: false });
    expect(
      ws.authenticate({ cookie: `recap_session=${signSessionValue("nope", SECRET)}` }),
    ).toEqual({ ok: false });
  });

  it("rejects expired sessions and disabled users", async () => {
    const { ws, login, advance, repos, user } = await setup();
    const headers = { cookie: `recap_session=${login.cookieValue}` };
    repos.users.setDisabled(user.id, true);
    expect(ws.authenticate(headers)).toEqual({ ok: false });
    repos.users.setDisabled(user.id, false);
    expect(ws.authenticate(headers).ok).toBe(true);
    advance(SESSION_IDLE_TTL_MS + 1);
    expect(ws.authenticate(headers)).toEqual({ ok: false });
  });

  it("service token works only when configured", async () => {
    const enabled = await setup("service-token-1234567890");
    expect(enabled.ws.authenticate({ authorization: "Bearer service-token-1234567890" })).toEqual({
      ok: true,
      kind: "service",
    });
    expect(enabled.ws.authenticate({ authorization: "Bearer wrong" })).toEqual({ ok: false });
    const disabled = await setup();
    expect(disabled.ws.authenticate({ authorization: "Bearer service-token-1234567890" })).toEqual({
      ok: false,
    });
  });
});
