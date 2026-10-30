import type { Segment, ServerMessage, SourceLang, TargetLang } from "@recap/core";
import type { MeetingSession } from "./meeting-session";

export type SessionSink = (message: ServerMessage) => void;

/** Extension points for the translation layer (T5) — no session internals need editing. */
export interface SessionHooks {
  /** Called after a segment was persisted and sent to the client. Must not throw. */
  onFinalSegment?: (segment: Segment, session: MeetingSession) => void;
  /**
   * Called during stop after the final flush, before `stopped` is sent: resolve when in-flight
   * work (e.g. translations) is done. Bounded by the session; rejections are logged.
   */
  onDrain?: (session: MeetingSession) => Promise<void>;
  /** Called once when the session has fully stopped (flushed, wav closed, meeting ended). */
  onStopped?: (session: MeetingSession) => void;
}

export interface TranslationInput {
  segmentId: string;
  seq: number;
  lang: TargetLang;
  text: string;
  provider: string;
  latencyMs: number;
}

export interface TranslateStatus {
  provider: string | null;
  degraded: boolean;
}

/** `error`: the session crashed internally; the client gets an error, then `stopped`. */
export type StopReason = "client" | "disconnect" | "error";

export interface SessionLanguages {
  sourceLang: SourceLang;
  targetLang: TargetLang;
}
