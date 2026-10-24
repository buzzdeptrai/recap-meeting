import { describe, expect, it } from "vitest";
import { checkPasswordPolicy, hashPassword, needsRehash, verifyPassword } from "../src";
import { PASSWORD, passwordHash } from "./helpers";

describe("passwords", () => {
  it("hashes to a versioned scrypt string and verifies", async () => {
    const hash = await passwordHash();
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$[^$]+\$[^$]+$/);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword("wrong password!", hash)).toBe(false);
    expect(needsRehash(hash)).toBe(false);
  });

  it("uses a fresh salt each time", async () => {
    const a = await hashPassword("some password 1", Buffer.alloc(16, 1));
    const b = await hashPassword("some password 1", Buffer.alloc(16, 2));
    expect(a).not.toBe(b);
  });

  it("rejects malformed or hostile hash strings without throwing", async () => {
    for (const bad of [
      "",
      "plain",
      "scrypt$1$2",
      "bcrypt$1$1$1$a$b",
      "scrypt$3$8$1$YQ$YQ",
      "scrypt$4294967296$8$1$YQ$YQ",
      "scrypt$16384$8$1$YQ$",
    ]) {
      expect(await verifyPassword(PASSWORD, bad)).toBe(false);
    }
  });

  it("flags weaker parameters for rehash", () => {
    expect(needsRehash("scrypt$16384$8$1$YQ$YQ")).toBe(true);
  });

  it("enforces the policy (min 10)", () => {
    expect(checkPasswordPolicy("short")).toMatch(/10/);
    expect(checkPasswordPolicy("          ")).not.toBeNull();
    expect(checkPasswordPolicy("x".repeat(300))).not.toBeNull();
    expect(checkPasswordPolicy("long enough pw")).toBeNull();
  });
});
