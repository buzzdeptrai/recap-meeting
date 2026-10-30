import type { MeetingSession } from "./meeting-session";

/** Who runs a session; lets a newer connection of the same user take it over. */
export interface SessionOwner {
  /** Authenticated user id; null for service-token tools (never eligible for takeover). */
  readonly userId: string | null;
  /** Ends this owner's session (flushing it) and tells its client; resolves when the slot is free. */
  replace(): Promise<void>;
}

/** Tracks the single active session per meeting id. */
export class SessionRegistry {
  private readonly sessions = new Map<string, MeetingSession>();
  private readonly owners = new Map<string, SessionOwner>();
  private readonly reserved = new Set<string>();

  has(meetingId: string): boolean {
    return this.sessions.has(meetingId) || this.reserved.has(meetingId);
  }

  /** Claims the slot synchronously (before any await) so concurrent starts cannot both win. */
  reserve(meetingId: string): boolean {
    if (this.has(meetingId)) return false;
    this.reserved.add(meetingId);
    return true;
  }

  register(session: MeetingSession, owner?: SessionOwner): void {
    this.reserved.delete(session.meetingId);
    this.sessions.set(session.meetingId, session);
    if (owner) this.owners.set(session.meetingId, owner);
  }

  release(meetingId: string): void {
    this.reserved.delete(meetingId);
    this.sessions.delete(meetingId);
    this.owners.delete(meetingId);
  }

  ownerOf(meetingId: string): SessionOwner | undefined {
    return this.owners.get(meetingId);
  }

  /** Meeting ids with an active session (diagnostics for crash logs). */
  activeMeetingIds(): string[] {
    return [...this.sessions.keys()];
  }

  get size(): number {
    return this.sessions.size;
  }

  /** Gracefully stops every active session (server shutdown). */
  async stopAll(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((session) => session.stop("disconnect")));
  }
}
