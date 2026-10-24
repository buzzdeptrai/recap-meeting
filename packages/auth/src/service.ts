import { randomBytes } from "node:crypto";
import type { Repositories, StoredUser } from "@recap/db";
import {
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_ID_BYTES,
  SESSION_IDLE_TTL_MS,
  SESSION_TOUCH_INTERVAL_MS,
} from "./constants";
import { checkPasswordPolicy, hashPassword, needsRehash, verifyPassword } from "./password";
import { LoginRateLimiter } from "./rate-limit";
import { signSessionValue, verifySessionValue } from "./token";
import type { AuthenticatedSession, AuthUser, LoginInput, LoginResult } from "./types";

export interface AuthServiceDeps {
  repos: Pick<Repositories, "users" | "sessions">;
  secret: string;
  /** Epoch milliseconds. */
  clock?: () => number;
  random?: (size: number) => Buffer;
  idleTtlMs?: number;
  absoluteTtlMs?: number;
}

export type PasswordChangeResult = { ok: true } | { ok: false; message: string };

const toAuthUser = (user: StoredUser): AuthUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
});

export class AuthService {
  private readonly clock: () => number;
  private readonly random: (size: number) => Buffer;
  private readonly idleTtl: number;
  private readonly absoluteTtl: number;
  private readonly limiter: LoginRateLimiter;
  private dummyHash: Promise<string> | undefined;

  constructor(private readonly deps: AuthServiceDeps) {
    this.clock = deps.clock ?? Date.now;
    this.random = deps.random ?? randomBytes;
    this.idleTtl = deps.idleTtlMs ?? SESSION_IDLE_TTL_MS;
    this.absoluteTtl = deps.absoluteTtlMs ?? SESSION_ABSOLUTE_TTL_MS;
    this.limiter = new LoginRateLimiter(this.clock);
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    const locked = this.limiter.lockedForMs(input.ip, email);
    if (locked > 0) return { ok: false, reason: "locked", retryAfterSec: Math.ceil(locked / 1000) };

    const user = this.deps.repos.users.getByEmail(email);
    // Unknown users still pay for one scrypt so timing does not reveal which emails exist.
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const matches = await verifyPassword(input.password, hash);
    if (!user || !matches || user.disabled) {
      this.limiter.recordFailure(input.ip, email);
      return { ok: false, reason: "invalid" };
    }
    this.limiter.recordSuccess(input.ip, email);
    return this.startSession(user, input);
  }

  private async startSession(user: StoredUser, input: LoginInput): Promise<LoginResult> {
    const { users, sessions } = this.deps.repos;
    if (needsRehash(user.passwordHash))
      users.setPassword(user.id, await hashPassword(input.password));
    const sessionId = this.random(SESSION_ID_BYTES).toString("base64url");
    const expiresAt = new Date(this.clock() + this.idleTtl).toISOString();
    sessions.create({
      id: sessionId,
      userId: user.id,
      expiresAt,
      userAgent: input.userAgent ?? null,
    });
    users.touchLogin(user.id);
    sessions.deleteExpired(new Date(this.clock()).toISOString());
    return {
      ok: true,
      user: toAuthUser(user),
      sessionId,
      cookieValue: signSessionValue(sessionId, this.deps.secret),
      expiresAt,
    };
  }

  /**
   * Validates a cookie value: signature, session row, idle + absolute expiry, user not disabled.
   * Slides the idle expiry (rewritten at most every few minutes).
   */
  authenticate(cookieValue: string | undefined | null): AuthenticatedSession | null {
    const sessionId = verifySessionValue(cookieValue, this.deps.secret);
    if (!sessionId) return null;
    const { users, sessions } = this.deps.repos;
    const session = sessions.get(sessionId);
    if (!session) return null;
    const now = this.clock();
    const createdAt = Date.parse(session.createdAt);
    if (Date.parse(session.expiresAt) <= now || createdAt + this.absoluteTtl <= now) {
      sessions.delete(sessionId);
      return null;
    }
    const user = users.getById(session.userId);
    if (!user || user.disabled) return null;
    if (now - Date.parse(session.lastSeenAt) >= SESSION_TOUCH_INTERVAL_MS) {
      const slid = Math.min(now + this.idleTtl, createdAt + this.absoluteTtl);
      sessions.touch(sessionId, new Date(slid).toISOString());
    }
    return { user: toAuthUser(user), sessionId };
  }

  getSessionUser(cookieValue: string | undefined | null): AuthUser | null {
    return this.authenticate(cookieValue)?.user ?? null;
  }

  logout(cookieValue: string | undefined | null): void {
    const sessionId = verifySessionValue(cookieValue, this.deps.secret);
    if (sessionId) this.deps.repos.sessions.delete(sessionId);
  }

  /** Verifies the current password, stores the new one and signs out every other session. */
  async changePassword(
    userId: string,
    keepSessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<PasswordChangeResult> {
    const user = this.deps.repos.users.getById(userId);
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return { ok: false, message: "Mật khẩu hiện tại không đúng." };
    }
    const problem = checkPasswordPolicy(newPassword);
    if (problem) return { ok: false, message: problem };
    this.deps.repos.users.setPassword(userId, await hashPassword(newPassword));
    this.deps.repos.sessions.deleteOthersForUser(userId, keepSessionId);
    return { ok: true };
  }

  /** Admin reset: replaces the password and signs the user out everywhere. */
  async resetPassword(userId: string, newPassword: string): Promise<void> {
    this.deps.repos.users.setPassword(userId, await hashPassword(newPassword));
    this.deps.repos.sessions.deleteForUser(userId);
  }

  /** Random one-time password for admin resets (shown once, never stored in clear). */
  generateTempPassword(): string {
    return this.random(15).toString("base64url");
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hashPassword("dummy-password-for-timing");
    return this.dummyHash;
  }
}
