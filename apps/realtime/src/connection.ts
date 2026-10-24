import type { ClientMessage, ErrorCode, ServerMessage } from "@recap/core";
import { encodeServerMessage, parseClientMessage } from "@recap/core";
import type { RawData, WebSocket } from "ws";
import type { RealtimeDeps } from "./deps";
import {
  CLOSE_POLICY_VIOLATION,
  MAX_AUDIO_FRAMES_PER_WINDOW,
  MAX_CONTROL_PER_WINDOW,
  RateLimiter,
} from "./limits";
import type { MeetingSession } from "./session/meeting-session";
import { StartRefusedError, createMeetingSession } from "./session/start-session";

function toBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

/**
 * State of one client socket: parses frames, routes control messages to the MeetingSession and
 * guarantees the session is stopped when the socket goes away.
 */
export class ClientConnection {
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
  ) {}

  handleMessage(data: RawData, isBinary: boolean): void {
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
    if (this.socket.readyState !== this.socket.OPEN) return;
    this.socket.send(encodeServerMessage(message));
  }

  private sendError(code: ErrorCode, message: string): void {
    this.send({ type: "error", code, message });
  }

  private handleAudio(frame: Buffer): void {
    const accepted = this.ready && this.session?.handleAudio(frame) === true;
    if (accepted || this.badAudioReported) return;
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
      case "stop":
        if (this.requireSession()) await this.stopSession("client");
        return;
      case "ping":
        return;
    }
  }

  private requireSession(): boolean {
    if (this.ready && this.session?.isLive) return true;
    this.sendError("BAD_MESSAGE", "No active session; send start first");
    return false;
  }

  private async start(message: Extract<ClientMessage, { type: "start" }>): Promise<void> {
    if (!this.deps) return this.sendError("INTERNAL", "Server is not configured for sessions");
    if (this.session) return this.sendError("BAD_MESSAGE", "Session already started");
    if (this.closed) return;
    try {
      this.session = createMeetingSession(this.deps, message, (m) => this.send(m));
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

  private async stopSession(reason: "client" | "disconnect"): Promise<void> {
    const session = this.session;
    if (!session) return;
    this.ready = false;
    await session.stop(reason);
    if (this.session === session) this.session = null;
  }
}
