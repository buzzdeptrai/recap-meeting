import { AuthService, hashPassword, verifyPassword } from "@recap/auth";
import { IN_MEMORY, createRepositories, openDatabase } from "@recap/db";
import { describe, expect, it } from "vitest";
import {
  createUser,
  createUserSchema,
  listUsers,
  patchUserSchema,
  toUserDto,
  updateUser,
} from "./users-service";

const SECRET = "web-test-secret-web-test-secret-123456";

async function setup() {
  const repos = createRepositories(openDatabase(IN_MEMORY));
  const auth = new AuthService({ repos, secret: SECRET });
  const hash = await hashPassword("admin password 1");
  const admin = repos.users.create({
    email: "root@example.com",
    name: "Root",
    role: "admin",
    passwordHash: hash,
  });
  return { repos, auth, deps: { repos, auth }, admin };
}

describe("users-service", () => {
  it("creates a member with a generated one-time password that verifies", async () => {
    const { deps, repos } = await setup();
    const input = createUserSchema.parse({ email: " New@Example.com ", name: "New" });
    const { user, tempPassword } = await createUser(deps, input);
    expect(user).toMatchObject({ email: "new@example.com", role: "member", disabled: false });
    expect(JSON.stringify(user)).not.toContain("hash");
    expect(
      await verifyPassword(tempPassword ?? "", repos.users.getById(user.id)?.passwordHash ?? ""),
    ).toBe(true);
  });

  it("uses a supplied password (policy enforced) and rejects duplicates", async () => {
    const { deps } = await setup();
    await expect(
      createUser(deps, createUserSchema.parse({ email: "a@b.co", name: "A", password: "short" })),
    ).rejects.toThrow(/10/);
    await createUser(
      deps,
      createUserSchema.parse({ email: "a@b.co", name: "A", password: "long enough password" }),
    );
    await expect(
      createUser(
        deps,
        createUserSchema.parse({ email: "A@B.co", name: "A", password: "long enough password" }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("lists users without hashes", async () => {
    const { deps } = await setup();
    expect(listUsers(deps)).toHaveLength(1);
    expect(Object.keys(listUsers(deps)[0] ?? {})).not.toContain("passwordHash");
  });

  it("refuses to disable or demote yourself, and the last admin", async () => {
    const { deps, admin, repos } = await setup();
    await expect(updateUser(deps, admin.id, admin.id, { disabled: true })).rejects.toMatchObject({
      code: "SELF_LOCKOUT",
    });
    await expect(updateUser(deps, admin.id, admin.id, { role: "member" })).rejects.toMatchObject({
      code: "SELF_LOCKOUT",
    });
    const other = repos.users.create({
      email: "o@example.com",
      name: "O",
      role: "admin",
      passwordHash: "x",
    });
    await updateUser(deps, admin.id, other.id, { role: "member" });
    const sole = repos.users.create({
      email: "s@example.com",
      name: "S",
      role: "admin",
      passwordHash: "x",
    });
    repos.users.setDisabled(admin.id, true);
    await expect(updateUser(deps, other.id, sole.id, { disabled: true })).rejects.toMatchObject({
      code: "LAST_ADMIN",
    });
  });

  it("disables a user and drops their sessions; renames; changes role", async () => {
    const { deps, admin, repos } = await setup();
    const member = repos.users.create({
      email: "m@example.com",
      name: "M",
      role: "member",
      passwordHash: "x",
    });
    repos.sessions.create({ id: "s1", userId: member.id, expiresAt: "2999-01-01T00:00:00.000Z" });
    const result = await updateUser(deps, admin.id, member.id, {
      disabled: true,
      name: "Mm",
      role: "admin",
    });
    expect(result.user).toMatchObject({ disabled: true, name: "Mm", role: "admin" });
    expect(repos.sessions.get("s1")).toBeNull();
  });

  it("resets a password: returns it once, old sessions die, new one works", async () => {
    const { deps, admin, repos } = await setup();
    const member = repos.users.create({
      email: "m@example.com",
      name: "M",
      role: "member",
      passwordHash: await hashPassword("old password 12"),
    });
    repos.sessions.create({ id: "s1", userId: member.id, expiresAt: "2999-01-01T00:00:00.000Z" });
    const { tempPassword } = await updateUser(deps, admin.id, member.id, { resetPassword: true });
    expect(tempPassword).toBeTruthy();
    expect(repos.sessions.get("s1")).toBeNull();
    expect(
      await verifyPassword(tempPassword ?? "", repos.users.getById(member.id)?.passwordHash ?? ""),
    ).toBe(true);
  });

  it("404s on unknown users and validates patches", async () => {
    const { deps, admin } = await setup();
    await expect(updateUser(deps, admin.id, "nope", { name: "x" })).rejects.toMatchObject({
      status: 404,
    });
    expect(patchUserSchema.safeParse({}).success).toBe(false);
    expect(patchUserSchema.safeParse({ role: "root" }).success).toBe(false);
    expect(toUserDto(deps.repos.users.list()[0]!)).not.toHaveProperty("passwordHash");
  });
});
