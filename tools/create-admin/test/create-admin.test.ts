import { verifyPassword } from "@recap/auth";
import { IN_MEMORY, createRepositories, openDatabase } from "@recap/db";
import { describe, expect, it } from "vitest";
import { createOrUpdateAdmin } from "../src/create-admin";

const PASSWORD = "a very long password";
const setup = () => createRepositories(openDatabase(IN_MEMORY));

describe("createOrUpdateAdmin", () => {
  it("creates an admin with a hashed password and lowercased email", async () => {
    const repos = setup();
    const result = await createOrUpdateAdmin(repos, {
      email: " Boss@Example.com ",
      name: "Boss",
      password: PASSWORD,
    });
    expect(result).toEqual({ action: "created", email: "boss@example.com" });
    const user = repos.users.getByEmail("boss@example.com");
    expect(user).toMatchObject({ role: "admin", disabled: false, name: "Boss" });
    expect(user?.passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, user?.passwordHash ?? "")).toBe(true);
  });

  it("updates an existing user: promotes, enables, resets password, drops sessions", async () => {
    const repos = setup();
    const member = repos.users.create({
      email: "m@example.com",
      name: "M",
      role: "member",
      passwordHash: "x",
    });
    repos.users.setDisabled(member.id, true);
    repos.sessions.create({ id: "s", userId: member.id, expiresAt: "2999-01-01T00:00:00.000Z" });
    const result = await createOrUpdateAdmin(repos, {
      email: "m@example.com",
      name: "Mm",
      password: PASSWORD,
    });
    expect(result.action).toBe("updated");
    expect(repos.users.getById(member.id)).toMatchObject({
      role: "admin",
      disabled: false,
      name: "Mm",
    });
    expect(repos.sessions.get("s")).toBeNull();
  });

  it("rejects bad email, empty name and weak password", async () => {
    const repos = setup();
    await expect(
      createOrUpdateAdmin(repos, { email: "nope", name: "A", password: PASSWORD }),
    ).rejects.toThrow();
    await expect(
      createOrUpdateAdmin(repos, { email: "a@b.co", name: " ", password: PASSWORD }),
    ).rejects.toThrow();
    await expect(
      createOrUpdateAdmin(repos, { email: "a@b.co", name: "A", password: "short" }),
    ).rejects.toThrow(/10/);
    expect(repos.users.list()).toHaveLength(0);
  });
});
