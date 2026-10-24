import type BetterSqlite3 from "better-sqlite3";
import type {
  Channel,
  MarkKind,
  MinutesContent,
  MinutesLang,
  MinutesSource,
  SourceLang,
  TargetLang,
} from "@recap/core";

export type Db = BetterSqlite3.Database;

/** Injected so repositories are deterministic in tests. */
export interface RepoContext {
  db: Db;
  now: () => string;
  newId: () => string;
}

export type MeetingStatus = "draft" | "live" | "ended";

export interface Meeting {
  id: string;
  title: string;
  status: MeetingStatus;
  sourceLang: SourceLang | null;
  targetLang: TargetLang | null;
  agenda: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
}

export interface StoredSegment {
  id: string;
  meetingId: string;
  seq: number;
  channel: Channel;
  lang: string | null;
  startMs: number;
  endMs: number;
  text: string;
  createdAt: string;
}

export interface Translation {
  segmentId: string;
  lang: TargetLang;
  text: string;
  provider: string;
  latencyMs: number;
  createdAt: string;
}

export interface StoredMark {
  id: string;
  meetingId: string;
  kind: MarkKind;
  atMs: number;
  label: string | null;
  createdAt: string;
}

export type GlossaryLang = "vi" | "en";

export interface TermVariant {
  id: string;
  termId: string;
  variant: string;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  lang: GlossaryLang;
  translation: string | null;
  doNotTranslate: boolean;
  priority: number;
  createdAt: string;
  variants: TermVariant[];
}

export interface StoredMinutes {
  meetingId: string;
  lang: MinutesLang;
  content: MinutesContent;
  source: MinutesSource;
  model: string | null;
  /** Prompt version the AI version was generated with; null for rows from before versioning. */
  promptVersion: string | null;
  /** Fingerprint of the marks used at generation; null for rows from before versioning. */
  marksFingerprint: string | null;
  generatedAt: string;
  updatedAt: string;
}

export type MinutesRunStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type MinutesRunPhase = "map" | "reduce" | "finalize";

export interface MinutesRun {
  id: string;
  meetingId: string;
  lang: MinutesLang;
  status: MinutesRunStatus;
  totalChunks: number;
  doneChunks: number;
  phase: MinutesRunPhase | null;
  /** Short, safe text (never keys or prompts). */
  error: string | null;
  model: string | null;
  promptVersion: string | null;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export type UserRole = "admin" | "member";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface StoredSession {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  userAgent: string | null;
}
