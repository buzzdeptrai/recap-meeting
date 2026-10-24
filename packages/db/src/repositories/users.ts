import type { RepoContext, StoredUser, UserRole } from "../types";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string;
  disabled: number;
  created_at: string;
  last_login_at: string | null;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
}

const toUser = (row: UserRow): StoredUser => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role as UserRole,
  passwordHash: row.password_hash,
  disabled: row.disabled === 1,
  createdAt: row.created_at,
  lastLoginAt: row.last_login_at,
});

/** Emails are stored and looked up lowercased. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export function createUsersRepository({ db, now, newId }: RepoContext) {
  const insertStmt = db.prepare(
    `INSERT INTO users (id, email, name, role, password_hash, disabled, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
  );
  const byEmail = db.prepare<[string], UserRow>("SELECT * FROM users WHERE email = ?");
  const byId = db.prepare<[string], UserRow>("SELECT * FROM users WHERE id = ?");
  const listStmt = db.prepare<[], UserRow>("SELECT * FROM users ORDER BY created_at, rowid");
  const passwordStmt = db.prepare("UPDATE users SET password_hash = ? WHERE id = ?");
  const disabledStmt = db.prepare("UPDATE users SET disabled = ? WHERE id = ?");
  const roleStmt = db.prepare("UPDATE users SET role = ? WHERE id = ?");
  const nameStmt = db.prepare("UPDATE users SET name = ? WHERE id = ?");
  const loginStmt = db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?");
  const adminCountStmt = db.prepare<[], { n: number }>(
    "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND disabled = 0",
  );

  const getById = (id: string): StoredUser | null => {
    const row = byId.get(id);
    return row ? toUser(row) : null;
  };

  return {
    /** Throws on a duplicate email (UNIQUE). */
    create(input: CreateUserInput): StoredUser {
      const id = newId();
      insertStmt.run(
        id,
        normalizeEmail(input.email),
        input.name,
        input.role,
        input.passwordHash,
        now(),
      );
      return getById(id) as StoredUser;
    },
    getByEmail(email: string): StoredUser | null {
      const row = byEmail.get(normalizeEmail(email));
      return row ? toUser(row) : null;
    },
    getById,
    list: (): StoredUser[] => listStmt.all().map(toUser),
    setPassword: (id: string, passwordHash: string): void =>
      void passwordStmt.run(passwordHash, id),
    setDisabled: (id: string, disabled: boolean): void =>
      void disabledStmt.run(disabled ? 1 : 0, id),
    setRole: (id: string, role: UserRole): void => void roleStmt.run(role, id),
    setName: (id: string, name: string): void => void nameStmt.run(name, id),
    touchLogin: (id: string): void => void loginStmt.run(now(), id),
    /** Enabled admins; used to protect the last one. */
    countActiveAdmins: (): number => adminCountStmt.get()?.n ?? 0,
  };
}

export type UsersRepository = ReturnType<typeof createUsersRepository>;
