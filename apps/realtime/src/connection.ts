import type { ClientMessage, ErrorCode, ServerMessage, StartMessage } from "@recap/core";
import { parseClientMessage } from "@recap/core";
import type { RawData, WebSocket } from "ws";
import { sendWithBackpressure } from "./backpressure";
import type { RealtimeDeps } from "./deps";
import {
  CLOSE_POLICY_VIOLATION,
  MAX_AUDIO_FRAMES_PER_WINDOW,
  MAX_CONTROL_PER_WINDOW,
  RateLimiter,
} from "./limits";
import type { MeetingSession } from "./session/meeting-session";
import type { SessionOwner } from "./session/registry";
import {
  SessionActiveError,
  StartRefusedError,
  createMeetingSession,
} from "./session/start-session";

function toBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

/**
 * State of one client socket: parses frames, routes control messages to the MeetingSession and
 * guarantees the session is stopped when the socket goes away.
 */
export class ClientConnection implements SessionOwner {
  private session: MeetingSession | null = null;
  private ready = false;
  private closed = false;
  private badAudioReported = false;
  /** Control messages run one at a time (start awaits the STT connection). */
  private queue: Promise<void> = Promise.resolve();
  private readonly audioLimiter = new RateLimiter(MAX_AUDIO_FRAMES_PER_WINDOW);
  private readonly controlLimiter = new RateLimiter(MAX_CONTROL_PER_WINDOW);

  constructor(
    private readonly socket: WebSocket,
    private readonly deps: RealtimeDeps | undefined,
    /** Authenticated user (null: service token or no authenticator). */
    readonly userId: string | null = null,
  ) {}

  /**
   * Entry point for socket frames. Nothing may throw out of here: an exception in an event
   * handler would be a process-level uncaught exception that ends every other live meeting.
   */
  handleMessage(data: RawData, isBinary: boolean): void {
    try {
      this.routeMessage(data, isBinary);
    } catch (error) {
      console.error("[ws] message handler failed:", error);
      if (this.session) this.session.fail("message handler", error);
      else this.sendError("INTERNAL", "Internal error");
    }
  }

  private routeMessage(data: RawData, isBinary: boolean): void {
    const limiter = isBinary ? this.audioLimiter : this.controlLimiter;
    if (!limiter.hit()) {
      this.socket.close(CLOSE_POLICY_VIOLATION, "Rate limit exceeded");
      return;
    }
    if (isBinary) {
      this.handleAudio(toBuffer(data));
      return;
    }
    const parsed = parseClientMessage(toBuffer(data));
    if (!parsed.ok) {
      this.sendError("BAD_MESSAGE", parsed.error);
      return;
    }
    if (parsed.message.type === "ping") {
      this.send({ type: "pong", t: parsed.message.t });
      return;
    }
    const message = parsed.message;
    this.queue = this.queue.then(() => this.runControl(message));
  }

  handleClose(): void {
    this.closed = true;
    // Never leave a rejected promise behind: the process treats unhandled rejections as fatal.
    this.queue = this.queue
      .then(() => this.stopSession("disconnect"))
      .catch((error: unknown) => console.error("[ws] failed to stop session on close:", error));
  }

  private send(message: ServerMessage): void {
    sendWithBackpressure(this.socket, message);
  }

  /** SessionOwner: a newer connection of the same user takes this meeting over. */
  async replace(): Promise<void> {
    this.sendError("SESSION_REPLACED", "This meeting was started from another window of yours");
    await this.stopSession("disconnect");
  }

  private sendError(code: ErrorCode, message: string): void {
    this.send({ type: "error", code, message });
  }

  private handleAudio(frame: Buffer): void {
    const accepted = this.ready && this.session?.handleAudio(frame) === true;
    if (accepted || this.badAudioReported) return;
    // A session that ended itself (crash, takeover) was reported once; stay quiet.
    if (this.session?.hasEnded) return;
    // One error per connection; further bad frames are only counted by the session.
    this.badAudioReported = true;
    const reason = this.ready ? "Bad audio frame size" : "Audio received before ready";
    this.sendError("BAD_MESSAGE", reason);
  }

  private async runControl(message: ClientMessage): Promise<void> {
    try {
      await this.dispatch(message);
    } catch (error) {
      console.error("[ws] control handler failed:", error);
      this.sendError("INTERNAL", "Internal error");
    }
  }

  private async dispatch(message: ClientMessage): Promise<void> {
    switch (message.type) {
      case "start":
        return this.start(message);
      case "mark":
        if (this.requireSession()) this.session?.addMark(message.kind, message.atMs, message.label);
        return;
      case "unmark":
        if (this.requireSession()) this.session?.removeMark(message.id);
        return;
      case "mark_label":
        if (this.requireSession()) this.session?.renameMark(message.id, message.label);
        return;
      case "stt_retry":
        return this.sttRetry();
      case "stop":
        if (this.requireSession()) await this.stopSession("client");
        return;
      case "ping":
        return;
    }
  }

  private sttRetry(): void {
    if (this.ready && this.session) return this.session.requestSttRetry();
    this.sendError("NOT_RECORDING", "No live recording");
  }

  private requireSession(): boolean {
    if (this.ready && this.session?.isLive) return true;
    this.sendError("BAD_MESSAGE", "No active session; send start first");
    return false;
  }

  private async start(message: Extract<ClientMessage, { type: "start" }>): Promise<void> {
    if (!this.deps) return this.sendError("INTERNAL", "Server is not configured for sessions");
    await this.dropEndedSession();
    if (this.session) return this.sendError("BAD_MESSAGE", "Session already started");
    if (this.closed) return;
    try {
      this.session = await this.createSession(this.deps, message);
    } catch (error) {
      if (!(error instanceof StartRefusedError)) throw error;
      return this.sendError(error.code, error.message);
    }
    try {
      await this.session.start();
    } catch (error) {
      await this.stopSession("disconnect");
      throw error;
    }
    this.ready = true;
    if (this.closed) await this.stopSession("disconnect");
  }

  /** A session that ended on its own (crash) no longer blocks a new `start` on this socket. */
  private async dropEndedSession(): Promise<void> {
    if (!this.session?.hasEnded) return;
    await this.stopSession("disconnect");
  }

  private async createSession(deps: RealtimeDeps, message: StartMessage): Promise<MeetingSession> {
    const create = (m: StartMessage) =>
      createMeetingSession(deps, m, (out) => this.send(out), this);
    try {
      return create(message);
    } catch (error) {
      if (!(error instanceof SessionActiveError) || !(await this.takeOver(deps, message))) {
        throw error;
      }
      return create({ ...message, resume: true });
    }
  }

  /**
   * The same authenticated user may replace their own other connection's session (e.g. a laptop
   * that went to sleep, or a second tab). A different user, or a service token, never can.
   */
  private async takeOver(deps: RealtimeDeps, message: StartMessage): Promise<boolean> {
    const owner = deps.registry.ownerOf(message.meetingId);
    if (!owner || owner === this || this.userId === null || owner.userId !== this.userId) {
      return false;
    }
    await owner.replace();
    return true;
  }

  private async stopSession(reason: "client" | "disconnect"): Promise<void> {
    const session = this.session;
    if (!session) return;
    this.ready = false;
    await session.stop(reason);
    if (this.session === session) this.session = null;
  }
}
