import type { UserRole } from "@recap/db";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export type LoginFailure = "invalid" | "locked";

export type LoginResult =
  | { ok: true; user: AuthUser; sessionId: string; cookieValue: string; expiresAt: string }
  | { ok: false; reason: LoginFailure; retryAfterSec?: number };

export interface LoginInput {
  email: string;
  password: string;
  ip: string;
  userAgent?: string | null;
}

export interface AuthenticatedSession {
  user: AuthUser;
  sessionId: string;
}
