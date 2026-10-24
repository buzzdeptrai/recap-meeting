import {
  encodeClientMessage,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
  type SourceLang,
  type TargetLang,
} from "@recap/core";

export type ConnectionState = "idle" | "connecting" | "ready" | "reconnecting" | "closed";

/** Subset of the browser WebSocket the client needs (lets tests inject a fake). */
export interface SocketLike {
  readyState: number;
  bufferedAmount: number;
  binaryType: string;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send: (data: string | ArrayBufferLike) => void;
  close: () => void;
}

export interface MeetingSocketOptions {
  url: string;
  meetingId: string;
  sourceLang: SourceLang;
  targetLang: TargetLang;
  /** Continue a meeting that already has segments. Reconnects always resume. */
  resume?: boolean;
  onMessage: (message: ServerMessage) => void;
  onConnection: (state: ConnectionState) => void;
  /** A frame failed zod validation; it is dropped. */
  onInvalid?: (reason: string) => void;
  createSocket?: (url: string) => SocketLike;
  backoffMs?: (attempt: number) => number;
}

export const DEFAULT_REALTIME_URL = "ws://localhost:4001/ws";
const WS_OPEN = 1;
const PING_INTERVAL_MS = 15_000;
const STOP_GRACE_MS = 3_000;
const MAX_BUFFERED_BYTES = 1_000_000;
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 8_000;

export const defaultBackoff = (attempt: number) =>
  Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);

/** Client side of the realtime protocol: start → ready → binary PCM frames, with reconnect. */
export class MeetingSocket {
  private socket: SocketLike | null = null;
  private state: ConnectionState = "idle";
  private attempt = 0;
  private wasReady = false;
  private intentionalClose = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private stopTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly options: MeetingSocketOptions) {}

  get connection(): ConnectionState {
    return this.state;
  }

  connect(): void {
    if (this.state !== "idle" && this.state !== "closed") return;
    this.intentionalClose = false;
    this.attempt = 0;
    this.open();
  }

  /** Immediate reconnect attempt (the "Thử lại" button). */
  retry(): void {
    if (this.state === "ready" || this.state === "connecting") return;
    clearTimeout(this.reconnectTimer);
    this.intentionalClose = false;
    this.attempt = 0;
    this.open();
  }

  /** Returns false when the frame was dropped (not ready, or the socket is backed up). */
  sendAudio(frame: ArrayBuffer): boolean {
    const socket = this.socket;
    if (this.state !== "ready" || !socket || socket.readyState !== WS_OPEN) return false;
    if (socket.bufferedAmount > MAX_BUFFERED_BYTES) return false;
    socket.send(frame);
    return true;
  }

  sendMark(atMs: number, kind: "conclusion" | "topic" = "conclusion"): boolean {
    return this.sendJson({ type: "mark", kind, atMs: Math.max(0, Math.round(atMs)) });
  }

  sendUnmark(id: string): boolean {
    return this.sendJson({ type: "unmark", id });
  }

  /** Renames a mark; an empty label clears it. */
  sendMarkLabel(id: string, label: string): boolean {
    return this.sendJson({ type: "mark_label", id, label });
  }

  /** Ask the server to finish; closes on `stopped` or after a short grace period. */
  stop(): void {
    this.intentionalClose = true;
    clearTimeout(this.reconnectTimer);
    if (!this.sendJson({ type: "stop" })) return this.finish();
    this.stopTimer = setTimeout(() => this.finish(), STOP_GRACE_MS);
  }

  close(): void {
    this.intentionalClose = true;
    this.finish();
  }

  private sendJson(message: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== WS_OPEN) return false;
    this.socket.send(encodeClientMessage(message));
    return true;
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.options.onConnection(state);
  }

  private open(): void {
    this.setState(this.wasReady || this.attempt > 0 ? "reconnecting" : "connecting");
    const create =
      this.options.createSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
    const socket = create(this.options.url);
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    socket.onopen = () => this.sendStart();
    socket.onmessage = (event) => this.handleMessage(event.data);
    socket.onclose = () => this.handleClose(socket);
    socket.onerror = () => undefined; // `close` always follows and drives reconnect
  }

  private sendStart(): void {
    const { meetingId, sourceLang, targetLang, resume } = this.options;
    this.sendJson({
      type: "start",
      meetingId,
      sourceLang,
      targetLang,
      ...(resume || this.wasReady ? { resume: true } : {}),
    });
  }

  private handleMessage(data: unknown): void {
    if (typeof data !== "string") return;
    const parsed = parseServerMessage(data);
    if (!parsed.ok) return this.options.onInvalid?.(parsed.error);
    const { message } = parsed;
    if (message.type === "ready") this.onReady();
    if (message.type === "stopped") this.finish();
    if (message.type !== "pong") this.options.onMessage(message);
  }

  private onReady(): void {
    this.wasReady = true;
    this.attempt = 0;
    this.setState("ready");
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(
      () => this.sendJson({ type: "ping", t: Date.now() }),
      PING_INTERVAL_MS,
    );
  }

  private handleClose(closed: SocketLike): void {
    if (this.socket !== closed) return;
    clearInterval(this.pingTimer);
    this.socket = null;
    if (this.intentionalClose) return this.setState("closed");
    const delay = (this.options.backoffMs ?? defaultBackoff)(this.attempt++);
    this.setState("reconnecting");
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private finish(): void {
    clearTimeout(this.stopTimer);
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingTimer);
    this.intentionalClose = true;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.setState("closed");
  }
}
