import type { Segment } from "@recap/core";
import { AllProvidersFailedError, type Translator } from "@recap/translate";
import type { MeetingSession } from "../session/meeting-session";
import type { SessionHooks } from "../session/types";
import { resolveDirection } from "./direction";

const log = (message: string, error?: unknown) =>
  console.error(`[translate] ${message}`, error instanceof Error ? error.message : (error ?? ""));

/**
 * Per-session translation: every final segment is translated in the background (never blocking
 * later segments), emitted + persisted via the session, and drained on stop.
 */
class SessionTranslation implements SessionHooks {
  private readonly pending = new Set<Promise<void>>();
  private lastStatusKey = "";

  constructor(private readonly translator: Translator) {}

  onFinalSegment = (segment: Segment, session: MeetingSession): void => {
    const task = this.translateSegment(segment, session).catch((error: unknown) =>
      log("unexpected translation error", error),
    );
    this.pending.add(task);
    void task.finally(() => this.pending.delete(task));
  };

  onDrain = async (): Promise<void> => {
    await Promise.allSettled([...this.pending]);
  };

  onStopped = (session: MeetingSession): void => {
    this.translator.endMeeting(session.meetingId);
  };

  private async translateSegment(segment: Segment, session: MeetingSession): Promise<void> {
    const direction = resolveDirection(segment.lang, session.languages, segment.text);
    if (!direction || !segment.text.trim()) return;
    try {
      const result = await this.translator.translate({
        meetingId: session.meetingId,
        seq: segment.seq,
        text: segment.text,
        ...direction,
      });
      session.emitTranslation({
        segmentId: segment.id,
        seq: segment.seq,
        lang: direction.targetLang,
        text: result.text,
        provider: result.provider,
        latencyMs: result.latencyMs,
      });
    } catch (error) {
      this.reportFailure(error, segment, session);
    }
    this.pushStatus(session);
  }

  private reportFailure(error: unknown, segment: Segment, session: MeetingSession): void {
    log(`segment ${segment.seq} not translated`, error);
    const message =
      error instanceof AllProvidersFailedError
        ? "Translation unavailable for this segment"
        : "Translation failed for this segment";
    session.sendError("TRANSLATE_FAILED", message, segment.id);
  }

  /** Sends `status` only when provider/degraded actually changed. */
  private pushStatus(session: MeetingSession): void {
    const { provider, degraded } = this.translator.status();
    const key = `${provider}|${degraded}`;
    if (key === this.lastStatusKey) return;
    this.lastStatusKey = key;
    session.setTranslateStatus({ provider, degraded });
  }
}

export function createSessionTranslation(translator: Translator): SessionHooks {
  return new SessionTranslation(translator);
}
