import { checkPasswordPolicy, hashPassword } from "@recap/auth";
import type { Repositories } from "@recap/db";

export interface CreateAdminInput {
  email: string;
  name: string;
  password: string;
}

export type CreateAdminResult = { action: "created" | "updated"; email: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Creates the admin, or promotes/enables/re-passwords an existing user with that email. */
export async function createOrUpdateAdmin(
  repos: Pick<Repositories, "users" | "sessions">,
  input: CreateAdminInput,
): Promise<CreateAdminResult> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new Error("Email không hợp lệ.");
  const name = input.name.trim();
  if (!name) throw new Error("Tên không được để trống (--name).");
  const problem = checkPasswordPolicy(input.password);
  if (problem) throw new Error(problem);

  const passwordHash = await hashPassword(input.password);
  const existing = repos.users.getByEmail(email);
  if (!existing) {
    repos.users.create({ email, name, role: "admin", passwordHash });
    return { action: "created", email };
  }
  repos.users.setName(existing.id, name);
  repos.users.setRole(existing.id, "admin");
  repos.users.setDisabled(existing.id, false);
  repos.users.setPassword(existing.id, passwordHash);
  repos.sessions.deleteForUser(existing.id);
  return { action: "updated", email };
}
