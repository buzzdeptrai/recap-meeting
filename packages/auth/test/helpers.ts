import { IN_MEMORY, createRepositories, openDatabase } from "@recap/db";
import { AuthService, hashPassword, type AuthServiceDeps } from "../src";

export const SECRET = "test-secret-test-secret-test-secret-1234";
export const PASSWORD = "correct horse battery";
const START = Date.parse("2026-10-22T00:00:00.000Z");

let sharedHash: Promise<string> | undefined;
/** One scrypt for the whole suite (hashing is deliberately slow). */
export const passwordHash = () => (sharedHash ??= hashPassword(PASSWORD));

export async function setupAuth(overrides: Partial<AuthServiceDeps> = {}) {
  let now = START;
  const clock = () => now;
  const db = openDatabase(IN_MEMORY);
  let counter = 0;
  const repos = createRepositories(db, {
    now: () => new Date(now).toISOString(),
    newId: () => `u-${++counter}`,
  });
  const user = repos.users.create({
    email: "an@example.com",
    name: "An",
    role: "member",
    passwordHash: await passwordHash(),
  });
  let seed = 0;
  const auth = new AuthService({
    repos,
    secret: SECRET,
    clock,
    random: (size) => Buffer.alloc(size, ++seed),
    ...overrides,
  });
  return {
    auth,
    repos,
    user,
    db,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

export const loginInput = (password = PASSWORD, email = "an@example.com", ip = "1.1.1.1") => ({
  email,
  password,
  ip,
});
