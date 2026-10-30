import { FRAME_BYTES, type ErrorCode, type MarkKind, type ServerMessage } from "@recap/core";
import { GhostLineFilter, type Segmenter, type SttResult, type SttStatus } from "@recap/stt";
import { handleChannelActivity } from "./channel-activity";
import { waitBounded } from "./drain";
import { meterAcceptedFrame } from "./frame-metering";
import { endMeetingRecorded, snapshotEnd, type EndSnapshot } from "./end-snapshot";
import { runMarkAction } from "./mark-action";
import { log, safely, safelySync } from "./safe";
import type { MeetingSessionOptions } from "./session-options";
import { attachProviderEvents, makeGuard, type Guard } from "./session-guard";
import { createSegmenters } from "./session-segmenters";
import { SttRetry } from "./stt-retry";
import { SttUsageMeter } from "./stt-usage-meter";
import { TranscriptRecorder } from "./transcript-recorder";
import type {
  SessionHooks,
  SessionLanguages,
  StopReason,
  TranslateStatus,
  TranslationInput,
} from "./types";

export type { MeetingSessionOptions };

type SessionState = "created" | "live" | "stopping" | "stopped";

/** One live meeting: STT in, segments out, audio + transcript persisted. */
export class MeetingSession {
  private state: SessionState = "created";
  private hooks: SessionHooks;
  private translateStatus: TranslateStatus = { provider: null, degraded: false };
  private sttStatus: SttStatus = "connecting";
  private readonly recorder: TranscriptRecorder;
  private readonly segmenters: Segmenter[];
  private readonly ghostFilter: GhostLineFilter;
  private stopPromise: Promise<void> | null = null;
  private framesAccepted = 0;
  private framesRejected = 0;
  private readonly usageMeter: SttUsageMeter | null;
  private readonly retry: SttRetry;
  /** End state of the meeting before this session re-opened it (resume of an ended meeting). */
  private previousEnd: EndSnapshot | null = null;
  private readonly guard: Guard = makeGuard((label, error) => this.fail(label, error));

  constructor(private readonly options: MeetingSessionOptions) {
    this.hooks = options.hooks ?? {};
    this.usageMeter = options.usage
      ? new SttUsageMeter({ ...options.usage, meetingId: options.meeting.id })
      : null;
    this.recorder = new TranscriptRecorder(options.repos, options.meeting.id, options.baseMs);
    this.ghostFilter = new GhostLineFilter({ sourceLang: options.sourceLang });
    this.segmenters = createSegmenters({
      options,
      recorder: this.recorder,
      ghostFilter: this.ghostFilter,
      guard: this.guard,
      send: (message) => this.sendEvent(message),
      onCommitted: (segment) =>
        safelySync("onFinalSegment hook", () => this.hooks.onFinalSegment?.(segment, this)),
    });
    this.attachProviderEvents();
    this.retry = new SttRetry(
      {
        isLive: () => this.state === "live",
        status: () => this.sttStatus,
        open: () => options.stt.open(),
        refuse: (code, message) => this.refuseSttRetry(code, message),
        failed: () => this.setSttClosed(),
        meterFrames: (count) => this.usageMeter?.addFrame(count),
      },
      options.sttRetry,
    );
  }

  get meetingId(): string {
    return this.options.meeting.id;
  }

  get languages(): SessionLanguages {
    return { sourceLang: this.options.sourceLang, targetLang: this.options.targetLang };
  }

  get isLive(): boolean {
    return this.state === "live";
  }

  /** Stopping or stopped (a crash ends a session without the connection asking for it). */
  get hasEnded(): boolean {
    return this.state === "stopping" || this.state === "stopped";
  }

  get rejectedFrames(): number {
    return this.framesRejected;
  }

  get acceptedFrames(): number {
    return this.framesAccepted;
  }

  setHooks(hooks: SessionHooks): void {
    this.hooks = hooks;
  }

  /** Sends any protocol event to the client (seam for the translation layer). */
  sendEvent(message: ServerMessage): void {
    this.options.sink(message);
  }

  sendError(code: ErrorCode, message: string, segmentId?: string): void {
    this.sendEvent({ type: "error", code, message, ...(segmentId ? { segmentId } : {}) });
  }

  /** Persists a translation and sends it to the client. */
  emitTranslation(input: TranslationInput): void {
    try {
      this.options.repos.translations.upsert(input);
    } catch (error) {
      log("failed to persist translation", error);
      this.sendError("INTERNAL", "Could not save translation", input.segmentId);
    }
    this.sendEvent({
      type: "translation",
      ...input,
      latencyMs: Math.max(0, Math.round(input.latencyMs)),
    });
  }

  setTranslateStatus(status: TranslateStatus): void {
    this.translateStatus = status;
    this.sendStatus();
  }

  /** Marks the meeting live, connects STT and tells the client it may stream audio. */
  async start(): Promise<void> {
    const { repos, meeting, stt } = this.options;
    this.previousEnd = snapshotEnd(repos.meetings.get(meeting.id));
    repos.meetings.start(meeting.id);
    let sttError: string | null = null;
    try {
      await stt.open();
    } catch (error) {
      sttError = error instanceof Error ? error.message : "STT connection failed";
      log("STT unavailable; recording audio only", error);
    }
    this.state = "live";
    this.usageMeter?.start();
    const startedAt = repos.meetings.get(meeting.id)?.startedAt ?? new Date().toISOString();
    this.sendEvent({
      type: "ready",
      meetingId: meeting.id,
      startedAt,
      baseMs: this.options.baseMs,
    });
    if (sttError) {
      this.sttStatus = "closed";
      this.sendError(
        "STT_UNAVAILABLE",
        "Speech recognition is unavailable; audio is still recorded",
      );
    }
    this.sendStatus();
  }

  /** Accepts one stereo PCM frame. Returns false (and counts it) when the frame is unusable. */
  handleAudio(frame: Uint8Array): boolean {
    if (this.state !== "live") return false;
    if (frame.length !== FRAME_BYTES) {
      this.framesRejected += 1;
      return false;
    }
    this.framesAccepted += 1;
    try {
      this.options.audio.write(frame);
    } catch (error) {
      log("audio write failed", error);
    }
    try {
      this.options.stt.sendAudio(frame);
      meterAcceptedFrame(this.options.stt, this.retry, this.usageMeter, this.sttStatus);
    } catch (error) {
      this.fail("audio path", error);
      return false;
    }
    return true;
  }

  /**
   * An unexpected error inside this session's callbacks (STT events, timers, segment handling):
   * log with the meeting id, tell the client, and end only this session. Other meetings and the
   * process keep running; the meeting can be resumed. Idempotent while stopping.
   */
  fail(where: string, error: unknown): void {
    log(`${this.meetingId} crashed in ${where}`, error);
    if (this.state === "stopping" || this.state === "stopped") return;
    safelySync("notify client of crash", () =>
      this.sendError(
        "INTERNAL",
        "Recording stopped because of an internal error. Resume the meeting.",
      ),
    );
    void this.stop("error").catch((stopError: unknown) => log("failed to stop crashed", stopError));
  }

  /** Restarts the STT provider after it gave up (browser `stt_retry`). Idempotent. */
  requestSttRetry(): void {
    this.retry.request();
  }

  private refuseSttRetry(code: ErrorCode, message: string): void {
    this.sendError(code, message);
    if (code === "STT_ALREADY_OPEN") this.sendStatus();
  }

  private setSttClosed(): void {
    this.sttStatus = "closed";
    this.sendStatus();
  }

  addMark(kind: MarkKind, atMs: number, label?: string): void {
    runMarkAction(this.sendEvent.bind(this), "save mark", () => ({
      type: "mark",
      mark: this.recorder.addMark(kind, atMs, label),
    }));
  }

  /** Renames a mark and echoes it as a `mark` event (same id = upsert on the client). */
  renameMark(id: string, label: string): void {
    runMarkAction(this.sendEvent.bind(this), "rename mark", () => {
      const mark = this.recorder.setMarkLabel(id, label);
      return mark ? { type: "mark", mark } : null;
    });
  }

  removeMark(id: string): void {
    runMarkAction(this.sendEvent.bind(this), "delete mark", () =>
      this.recorder.removeMark(id) ? { type: "unmark", id } : null,
    );
  }

  /** Flushes transcripts, closes audio, ends the meeting. Idempotent. */
  stop(reason: StopReason): Promise<void> {
    this.stopPromise ??= this.runStop(reason);
    return this.stopPromise;
  }

  private async runStop(reason: StopReason): Promise<void> {
    this.state = "stopping";
    await safely("close STT", () => this.options.stt.close());
    safelySync("record STT usage", () => this.usageMeter?.stop());
    for (const segmenter of this.segmenters) {
      safelySync("flush segmenter", () => segmenter.flush());
      segmenter.dispose();
    }
    await safely("drain hooks", () => waitBounded(this.hooks.onDrain?.(this)));
    safelySync("close audio", () => this.options.audio.close());
    safelySync("end meeting", () => this.endMeeting());
    this.state = "stopped";
    if (reason !== "disconnect") this.sendEvent({ type: "stopped", meetingId: this.meetingId });
    safelySync("onStopped hook", () => this.hooks.onStopped?.(this));
    this.options.onEnded?.();
    if (this.framesRejected > 0)
      log(`${this.framesRejected} bad frames dropped in ${this.meetingId}`);
  }

  /** Duration = total recorded audio (all runs), not wall clock which includes pauses between runs. */
  private endMeeting(): void {
    const keep = this.framesAccepted === 0 ? this.previousEnd : null;
    endMeetingRecorded(this.options.repos, this.meetingId, this.options.audio.durationMs, keep);
  }

  private attachProviderEvents(): void {
    attachProviderEvents(
      this.options.stt,
      {
        interim: (result) => this.route(result, "onInterim"),
        final: (result) => this.route(result, "onFinal"),
        status: (status) => {
          this.sttStatus = status;
          if (this.state === "live") this.sendStatus();
        },
        activity: (a) => handleChannelActivity(this.meetingId, a, this.segmenters),
        error: (error) => {
          log(`STT error (fatal=${error.fatal})`, error.message);
          if (error.fatal) this.sendError("STT_UNAVAILABLE", "Speech recognition connection lost");
        },
      },
      this.guard,
    );
  }

  private route(result: SttResult, method: "onInterim" | "onFinal"): void {
    if (this.state === "stopped") return;
    this.segmenters[result.channel]?.[method](result);
  }

  private sendStatus(): void {
    this.sendEvent({ type: "status", stt: this.sttStatus, translate: this.translateStatus });
  }
}
