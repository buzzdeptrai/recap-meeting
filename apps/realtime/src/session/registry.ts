import type { MeetingSession } from "./meeting-session";

/** Tracks the single active session per meeting id. */
export class SessionRegistry {
  private readonly sessions = new Map<string, MeetingSession>();
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

  register(session: MeetingSession): void {
    this.reserved.delete(session.meetingId);
    this.sessions.set(session.meetingId, session);
  }

  release(meetingId: string): void {
    this.reserved.delete(meetingId);
    this.sessions.delete(meetingId);
  }

  get size(): number {
    return this.sessions.size;
  }

  /** Gracefully stops every active session (server shutdown). */
  async stopAll(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((session) => session.stop("disconnect")));
  }
}
