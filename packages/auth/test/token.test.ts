import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSecretCache,
  readCookie,
  resolveAuthSecret,
  serializeClearedCookie,
  serializeSessionCookie,
  signSessionValue,
  verifyServiceToken,
  verifySessionValue,
} from "../src";
import { SECRET } from "./helpers";

afterEach(clearSecretCache);

describe("signed cookie value", () => {
  it("round-trips and rejects tampering", () => {
    const value = signSessionValue("abc_DEF-123", SECRET);
    expect(verifySessionValue(value, SECRET)).toBe("abc_DEF-123");
    expect(verifySessionValue(value.replace("abc", "abd"), SECRET)).toBeNull();
    expect(verifySessionValue(`${value}x`, SECRET)).toBeNull();
    expect(verifySessionValue(value, `${SECRET}!`)).toBeNull();
    expect(verifySessionValue("nodot", SECRET)).toBeNull();
    expect(verifySessionValue(".sig", SECRET)).toBeNull();
    expect(verifySessionValue("", SECRET)).toBeNull();
    expect(verifySessionValue(undefined, SECRET)).toBeNull();
  });
});

describe("service token", () => {
  it("accepts only the exact bearer token and is off when unset", () => {
    expect(verifyServiceToken("Bearer s3cret-token-value", "s3cret-token-value")).toBe(true);
    expect(verifyServiceToken("Bearer nope", "s3cret-token-value")).toBe(false);
    expect(verifyServiceToken("s3cret-token-value", "s3cret-token-value")).toBe(false);
    expect(verifyServiceToken("Bearer x", undefined)).toBe(false);
    expect(verifyServiceToken("Bearer ", "")).toBe(false);
    expect(verifyServiceToken(undefined, "abc")).toBe(false);
  });
});

describe("cookie helpers", () => {
  it("serializes the required attributes", () => {
    const cookie = serializeSessionCookie("v", { secure: true, maxAgeSec: 60 });
    expect(cookie).toBe("recap_session=v; Path=/; HttpOnly; SameSite=Lax; Max-Age=60; Secure");
    expect(serializeSessionCookie("v", { secure: false })).not.toMatch(/Secure|Max-Age/);
    expect(serializeClearedCookie(false)).toMatch(/Max-Age=0/);
  });

  it("reads a cookie out of a header", () => {
    expect(readCookie("a=1; recap_session=xyz.sig; b=2")).toBe("xyz.sig");
    expect(readCookie("a=1")).toBeNull();
    expect(readCookie(undefined)).toBeNull();
  });
});

describe("resolveAuthSecret", () => {
  const dir = () => join(mkdtempSync(join(tmpdir(), "recap-auth-")), "data", ".auth-secret");

  it("prefers AUTH_SECRET and validates its length", () => {
    expect(resolveAuthSecret({ env: { AUTH_SECRET: SECRET }, filePath: dir() })).toBe(SECRET);
    expect(() => resolveAuthSecret({ env: { AUTH_SECRET: "short" }, filePath: dir() })).toThrow();
  });

  it("refuses to start in production without AUTH_SECRET", () => {
    expect(() => resolveAuthSecret({ env: { NODE_ENV: "production" }, filePath: dir() })).toThrow(
      /AUTH_SECRET/,
    );
  });

  it("generates once in development, persists with mode 0600 and warns once", () => {
    const filePath = dir();
    const warn = vi.fn();
    const first = resolveAuthSecret({ env: {}, filePath, warn });
    clearSecretCache();
    const second = resolveAuthSecret({ env: {}, filePath, warn });
    expect(second).toBe(first);
    expect(readFileSync(filePath, "utf8").trim()).toBe(first);
    expect(statSync(filePath).mode & 0o777).toBe(0o600);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
