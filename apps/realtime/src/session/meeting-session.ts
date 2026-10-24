import {
  FRAME_BYTES,
  type ErrorCode,
  type MarkKind,
  type Segment,
  type ServerMessage,
} from "@recap/core";
import type { Meeting, Repositories } from "@recap/db";
import {
  Segmenter,
  type Clock,
  type RawSegment,
  type SegmenterConfig,
  type SttProvider,
  type SttResult,
  type SttStatus,
  type TimeRange,
  type VariantEntry,
} from "@recap/stt";
import type { AudioWriter } from "../audio/audio-writer";
import { waitBounded } from "./drain";
import { SttRetry, type SttRetryOptions } from "./stt-retry";
import { SttUsageMeter, type SttUsageMeterOptions } from "./stt-usage-meter";
import { TranscriptRecorder } from "./transcript-recorder";
import type {
  SessionHooks,
  SessionLanguages,
  SessionSink,
  StopReason,
  TranslateStatus,
  TranslationInput,
} from "./types";

export interface MeetingSessionOptions extends SessionLanguages {
  meeting: Meeting;
  repos: Repositories;
  stt: SttProvider;
  audio: AudioWriter;
  sink: SessionSink;
  /** Session audio timeline → meeting timeline offset (non-zero when resuming). */
  baseMs: number;
  variants?: readonly VariantEntry[];
  hooks?: SessionHooks;
  segmenterConfig?: Partial<SegmenterConfig>;
  clock?: Clock;
  /** Enables Deepgram usage metering for this session. */
  usage?: Omit<SttUsageMeterOptions, "meetingId">;
  /** Overrides for the manual STT retry guard (tests). */
  sttRetry?: SttRetryOptions;
  /** Invoked once at the very end of `stop()` (e.g. to release the registry slot). */
  onEnded?: () => void;
}

type SessionState = "created" | "live" | "stopping" | "stopped";

const log = (message: string, error?: unknown) =>
  console.error(`[session] ${message}`, error instanceof Error ? error.message : (error ?? ""));

/** One live meeting: STT in, segments out, audio + transcript persisted. */
export class MeetingSession {
  private state: SessionState = "created";
  private hooks: SessionHooks;
  private translateStatus: TranslateStatus = { provider: null, degraded: false };
  private sttStatus: SttStatus = "connecting";
  private readonly recorder: TranscriptRecorder;
  private readonly segmenters: Segmenter[];
  private stopPromise: Promise<void> | null = null;
  private framesAccepted = 0;
  private framesRejected = 0;
  private readonly usageMeter: SttUsageMeter | null;
  private readonly retry: SttRetry;

  constructor(private readonly options: MeetingSessionOptions) {
    this.hooks = options.hooks ?? {};
    this.usageMeter = options.usage
      ? new SttUsageMeter({ ...options.usage, meetingId: options.meeting.id })
      : null;
    this.recorder = new TranscriptRecorder(options.repos, options.meeting.id, options.baseMs);
    this.segmenters = [0, 1].map((channel) => this.createSegmenter(channel as 0 | 1));
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
    this.options.stt.sendAudio(frame);
    if (this.retry.isRunning) this.retry.countFrame();
    else if (this.sttStatus !== "closed") this.usageMeter?.addFrame();
    return true;
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
    this.markAction("save mark", () => ({
      type: "mark",
      mark: this.recorder.addMark(kind, atMs, label),
    }));
  }

  /** Renames a mark and echoes it as a `mark` event (same id = upsert on the client). */
  renameMark(id: string, label: string): void {
    this.markAction("rename mark", () => {
      const mark = this.recorder.setMarkLabel(id, label);
      return mark ? { type: "mark", mark } : null;
    });
  }

  removeMark(id: string): void {
    this.markAction("delete mark", () =>
      this.recorder.removeMark(id) ? { type: "unmark", id } : null,
    );
  }

  /** Runs a mark edit; `null` = unknown mark, a throw = persistence failure. */
  private markAction(failure: string, action: () => ServerMessage | null): void {
    try {
      const event = action();
      if (event) this.sendEvent(event);
      else this.sendError("BAD_MESSAGE", "Unknown mark");
    } catch (error) {
      log(`failed to ${failure}`, error);
      this.sendError("INTERNAL", `Could not ${failure}`);
    }
  }

  /** Flushes transcripts, closes audio, ends the meeting. Idempotent. */
  stop(reason: StopReason): Promise<void> {
    this.stopPromise ??= this.runStop(reason);
    return this.stopPromise;
  }

  private async runStop(reason: StopReason): Promise<void> {
    this.state = "stopping";
    await this.safely("close STT", () => this.options.stt.close());
    this.safelySync("record STT usage", () => this.usageMeter?.stop());
    for (const segmenter of this.segmenters) {
      this.safelySync("flush segmenter", () => segmenter.flush());
      segmenter.dispose();
    }
    await this.safely("drain hooks", () => waitBounded(this.hooks.onDrain?.(this)));
    this.safelySync("close audio", () => this.options.audio.close());
    this.safelySync("end meeting", () => this.endMeeting());
    this.state = "stopped";
    if (reason === "client") this.sendEvent({ type: "stopped", meetingId: this.meetingId });
    this.safelySync("onStopped hook", () => this.hooks.onStopped?.(this));
    this.options.onEnded?.();
    if (this.framesRejected > 0)
      log(`${this.framesRejected} bad frames dropped in ${this.meetingId}`);
  }

  /** Duration = total recorded audio (all runs), not wall clock which includes pauses between runs. */
  private endMeeting(): void {
    const recordedMs = this.options.audio.durationMs;
    this.options.repos.meetings.end(
      this.meetingId,
      undefined,
      recordedMs > 0 ? recordedMs : undefined,
    );
  }

  private createSegmenter(channel: 0 | 1): Segmenter {
    const variants = this.options.variants;
    return new Segmenter({
      channel,
      config: this.options.segmenterConfig,
      clock: this.options.clock,
      variants: variants ? () => variants : undefined,
      onSegment: (raw) => this.commitSegment(raw),
      onInterim: (text, range) => this.sendInterim(channel, text, range),
    });
  }

  private attachProviderEvents(): void {
    const { stt } = this.options;
    stt.on("interim", (result) => this.route(result, "onInterim"));
    stt.on("final", (result) => this.route(result, "onFinal"));
    stt.on("status", (status) => {
      this.sttStatus = status;
      if (this.state === "live") this.sendStatus();
    });
    stt.on("error", (error) => {
      log(`STT error (fatal=${error.fatal})`, error.message);
      if (error.fatal) this.sendError("STT_UNAVAILABLE", "Speech recognition connection lost");
    });
  }

  private route(result: SttResult, method: "onInterim" | "onFinal"): void {
    if (this.state === "stopped") return;
    this.segmenters[result.channel]?.[method](result);
  }

  private commitSegment(raw: RawSegment): void {
    let segment: Segment;
    try {
      segment = this.recorder.commit(raw);
    } catch (error) {
      log("failed to persist segment", error);
      this.sendError("INTERNAL", "Could not save transcript segment");
      return;
    }
    this.sendEvent({ type: "segment", segment });
    this.safelySync("onFinalSegment hook", () => this.hooks.onFinalSegment?.(segment, this));
  }

  private sendInterim(channel: 0 | 1, text: string, range: TimeRange): void {
    const startMs = this.recorder.toMeetingMs(range.startMs);
    const endMs = Math.max(startMs, this.recorder.toMeetingMs(range.endMs));
    this.sendEvent({ type: "interim", channel, text, startMs, endMs });
  }

  private sendStatus(): void {
    this.sendEvent({ type: "status", stt: this.sttStatus, translate: this.translateStatus });
  }

  private async safely(label: string, action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      log(`failed to ${label}`, error);
    }
  }

  private safelySync(label: string, action: () => void): void {
    try {
      action();
    } catch (error) {
      log(`failed: ${label}`, error);
    }
  }
}
