import { FRAME_MS } from "@recap/core";
import WebSocket from "ws";
import { SttEmitter } from "../emitter";
import type { SttProvider, SttStatus } from "../types";
import { computeBackoffMs } from "./backoff";
import {
  DEEPGRAM_DEFAULTS,
  DEFAULT_RECONNECT,
  type DeepgramConfig,
  type ReconnectConfig,
} from "./config";
import { parseDeepgramMessage } from "./parse";
import { ReplayBuffer } from "./replay-buffer";
import { buildListenUrl } from "./url";

/** The slice of `ws` WebSocket the provider uses (a fake implements it in tests). */
export type SttSocket = Pick<
  WebSocket,
  "readyState" | "send" | "close" | "terminate" | "on" | "removeAllListeners"
>;
export type SocketFactory = (url: string, headers: Record<string, string>) => SttSocket;

export interface DeepgramDeps {
  createSocket?: SocketFactory;
  /** Jitter source in [0, 1). */
  random?: () => number;
}

const defaultSocketFactory: SocketFactory = (url, headers) => new WebSocket(url, { headers });

const KEEP_ALIVE_MESSAGE = JSON.stringify({ type: "KeepAlive" });
const CLOSE_STREAM_MESSAGE = JSON.stringify({ type: "CloseStream" });

/**
 * Streaming Deepgram client (raw `ws`). Reconnects with backoff on unexpected drops and replays
 * the audio buffered meanwhile. Result timestamps are mapped onto the session audio timeline.
 */
export class DeepgramProvider extends SttEmitter implements SttProvider {
  readonly name = "deepgram";
  private readonly reconnect: ReconnectConfig;
  private readonly createSocket: SocketFactory;
  private readonly random: () => number;
  private readonly replay: ReplayBuffer;
  private socket: SttSocket | null = null;
  private status: SttStatus = "closed";
  private frameCounter = 0;
  private connectionBaseMs = 0;
  private attempt = 0;
  private closing = false;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: DeepgramConfig,
    deps: DeepgramDeps = {},
  ) {
    super();
    this.reconnect = { ...DEFAULT_RECONNECT, ...config.reconnect };
    this.createSocket = deps.createSocket ?? defaultSocketFactory;
    this.random = deps.random ?? Math.random;
    this.replay = new ReplayBuffer(this.reconnect.replayBufferFrames);
  }

  /** Frames waiting for a connection (exposed for tests / diagnostics). */
  get bufferedFrames(): number {
    return this.replay.size;
  }

  async open(): Promise<void> {
    this.closing = false;
    this.setStatus("connecting");
    try {
      await this.connectSocket();
    } catch (error) {
      // Frames buffered while connecting would be replayed out of order by a later open().
      this.replay.clear();
      this.setStatus("closed");
      throw error;
    }
  }

  sendAudio(frame: Uint8Array): void {
    const index = this.frameCounter++;
    if (this.status === "closed") return;
    if (this.status === "open" && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(frame);
      return;
    }
    this.replay.push({ index, data: frame });
  }

  async close(): Promise<void> {
    this.closing = true;
    this.clearTimers();
    this.replay.clear();
    const socket = this.socket;
    // Keep `this.socket` until the stream ends so trailing finals are still delivered.
    if (socket && socket.readyState === WebSocket.OPEN) await this.endStream(socket);
    else socket?.terminate();
    this.socket = null;
    this.setStatus("closed");
  }

  private setStatus(next: SttStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.emit("status", next);
  }

  private endStream(socket: SttSocket): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        socket.terminate();
        resolve();
      }, this.config.closeTimeoutMs ?? DEEPGRAM_DEFAULTS.closeTimeoutMs);
      socket.on("close", () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.send(CLOSE_STREAM_MESSAGE);
    });
  }

  /** Opens one socket; resolves once it is open and the replay buffer has been flushed. */
  private connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = this.createSocket(buildListenUrl(this.config), {
        Authorization: `Token ${this.config.apiKey}`,
      });
      let opened = false;
      const timeout = setTimeout(
        () => socket.terminate(),
        this.config.connectTimeoutMs ?? DEEPGRAM_DEFAULTS.connectTimeoutMs,
      );
      const fail = (reason: string) => {
        clearTimeout(timeout);
        if (!opened) reject(new Error(reason));
        else this.handleDrop(socket);
      };
      socket.on("open", () => {
        clearTimeout(timeout);
        if (this.closing) {
          // close() ran while this (re)connect was in flight: do not resurrect the stream.
          socket.removeAllListeners();
          socket.on("error", () => undefined);
          socket.terminate();
          reject(new Error("Deepgram provider closed while connecting"));
          return;
        }
        opened = true;
        this.onSocketOpen(socket);
        resolve();
      });
      socket.on("message", (data) => this.handleMessage(socket, String(data)));
      socket.on("error", (error) => fail(`Deepgram socket error: ${error.message}`));
      socket.on("close", (code) => fail(`Deepgram socket closed (code ${code})`));
    });
  }

  private onSocketOpen(socket: SttSocket): void {
    this.socket = socket;
    this.attempt = 0;
    const pending = this.replay.drain();
    this.connectionBaseMs = (pending[0]?.index ?? this.frameCounter) * FRAME_MS;
    for (const frame of pending) socket.send(frame.data);
    this.startKeepAlive(socket);
    this.setStatus("open");
  }

  private handleMessage(socket: SttSocket, data: string): void {
    if (socket !== this.socket) return;
    const parsed = parseDeepgramMessage(data, this.connectionBaseMs);
    if (parsed.kind === "ignored") return;
    if (parsed.kind === "error") {
      this.emit("error", { message: parsed.message, fatal: false });
      return;
    }
    this.emit(parsed.isFinal ? "final" : "interim", parsed.result);
  }

  private handleDrop(socket: SttSocket): void {
    if (socket !== this.socket) return;
    this.socket = null;
    this.stopKeepAlive();
    socket.removeAllListeners();
    socket.on("error", () => undefined);
    if (this.closing) return;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.attempt += 1;
    if (this.attempt > this.reconnect.maxAttempts) {
      this.replay.clear();
      this.setStatus("closed");
      this.emit("error", { message: "Deepgram connection lost; giving up", fatal: true });
      return;
    }
    this.setStatus("reconnecting");
    const delay = computeBackoffMs(this.attempt, this.reconnect, this.random);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectSocket().catch(() => {
        if (!this.closing) this.scheduleReconnect();
      });
    }, delay);
  }

  private startKeepAlive(socket: SttSocket): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(KEEP_ALIVE_MESSAGE);
    }, this.config.keepAliveMs ?? DEEPGRAM_DEFAULTS.keepAliveMs);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = null;
  }

  private clearTimers(): void {
    this.stopKeepAlive();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}
