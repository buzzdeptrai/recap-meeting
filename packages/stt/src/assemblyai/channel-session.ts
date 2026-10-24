import { FRAME_MS, type Channel } from "@recap/core";
import WebSocket from "ws";
import { computeBackoffMs } from "../deepgram/backoff";
import type { SocketFactory, SttSocket } from "../deepgram/provider";
import { ReplayBuffer } from "../deepgram/replay-buffer";
import type { SttResult, SttStatus } from "../types";
import {
  ASSEMBLYAI_DEFAULTS,
  DEFAULT_RECONNECT,
  type AssemblyAiConfig,
  type ReconnectConfig,
} from "./config";
import { parseAssemblyAiMessage } from "./parse";
import { buildStreamUrl } from "./url";

const TERMINATE_MESSAGE = JSON.stringify({ type: "Terminate" });

export interface ChannelCallbacks {
  onResult: (isFinal: boolean, result: SttResult) => void;
  onStatus: (status: SttStatus) => void;
  /** Non-fatal vendor error text. */
  onError: (message: string) => void;
  /** The channel gave up reconnecting. */
  onFatal: (message: string) => void;
}

/**
 * One AssemblyAI streaming session = one mono audio channel. Owns its socket, reconnect with
 * backoff, the replay buffer, and the mapping of socket-relative times to the session timeline.
 */
export class ChannelSession {
  private readonly reconnect: ReconnectConfig;
  private readonly replay: ReplayBuffer;
  private socket: SttSocket | null = null;
  private status: SttStatus = "closed";
  private connectionBaseMs = 0;
  private turnStartMs = 0;
  private nextIndex = 0;
  private attempt = 0;
  private closing = false;
  private fatalReason: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    readonly channel: Channel,
    private readonly config: AssemblyAiConfig,
    private readonly createSocket: SocketFactory,
    private readonly random: () => number,
    private readonly callbacks: ChannelCallbacks,
  ) {
    this.reconnect = { ...DEFAULT_RECONNECT, ...config.reconnect };
    this.replay = new ReplayBuffer(this.reconnect.replayBufferFrames);
  }

  get bufferedFrames(): number {
    return this.replay.size;
  }

  async open(): Promise<void> {
    this.closing = false;
    this.setStatus("connecting");
    try {
      await this.connectSocket();
    } catch (error) {
      this.setStatus("closed");
      throw error;
    }
  }

  /** `index` is the frame position on the session timeline (shared by both channels). */
  send(index: number, data: Uint8Array): void {
    this.nextIndex = index + 1;
    if (this.status === "closed") return;
    if (this.status === "open" && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(data);
      return;
    }
    this.replay.push({ index, data });
  }

  /** Sends Terminate, keeps reading until the server finishes, then closes the socket. */
  async close(): Promise<void> {
    this.closing = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.replay.clear();
    const socket = this.socket;
    if (socket && socket.readyState === WebSocket.OPEN) await this.endStream(socket);
    else socket?.terminate();
    this.socket = null;
    this.setStatus("closed");
  }

  /** Drops the connection immediately (no Terminate, no waiting). */
  abort(): void {
    this.closing = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.replay.clear();
    this.socket?.removeAllListeners();
    this.socket?.on("error", () => undefined);
    this.socket?.terminate();
    this.socket = null;
    this.setStatus("closed");
  }

  private setStatus(next: SttStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.callbacks.onStatus(next);
  }

  private endStream(socket: SttSocket): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        socket.terminate();
        resolve();
      }, this.config.closeTimeoutMs ?? ASSEMBLYAI_DEFAULTS.closeTimeoutMs);
      socket.on("close", () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.send(TERMINATE_MESSAGE);
    });
  }

  private connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      // The key goes in the Authorization header only (no "Bearer" prefix, per the docs).
      const socket = this.createSocket(buildStreamUrl(this.config), {
        Authorization: this.config.apiKey,
      });
      let opened = false;
      const timeout = setTimeout(
        () => socket.terminate(),
        this.config.connectTimeoutMs ?? ASSEMBLYAI_DEFAULTS.connectTimeoutMs,
      );
      const fail = (reason: string) => {
        clearTimeout(timeout);
        if (!opened) reject(new Error(reason));
        else this.handleDrop(socket);
      };
      socket.on("open", () => {
        clearTimeout(timeout);
        if (this.closing) {
          socket.removeAllListeners();
          socket.on("error", () => undefined);
          socket.terminate();
          reject(new Error("AssemblyAI provider closed while connecting"));
          return;
        }
        opened = true;
        this.onSocketOpen(socket);
        resolve();
      });
      socket.on("message", (data) => this.handleMessage(socket, String(data)));
      socket.on("error", (error) => fail(`AssemblyAI socket error: ${error.message}`));
      socket.on("close", (code) => fail(`AssemblyAI socket closed (code ${code})`));
    });
  }

  private onSocketOpen(socket: SttSocket): void {
    this.socket = socket;
    this.attempt = 0;
    this.turnStartMs = 0;
    const pending = this.replay.drain();
    // AssemblyAI times restart at 0 on every new socket: anchor them to the first replayed frame.
    this.connectionBaseMs = (pending[0]?.index ?? this.nextIndex) * FRAME_MS;
    for (const frame of pending) socket.send(frame.data);
    this.setStatus("open");
  }

  private handleMessage(socket: SttSocket, data: string): void {
    if (socket !== this.socket) return;
    const parsed = parseAssemblyAiMessage(
      data,
      this.channel,
      this.connectionBaseMs,
      this.turnStartMs,
    );
    switch (parsed.kind) {
      case "speech_started":
        this.turnStartMs = parsed.timestampMs;
        return;
      case "result":
        this.callbacks.onResult(parsed.isFinal, parsed.result);
        return;
      case "error":
        if (!parsed.retryable) this.fatalReason = parsed.message;
        this.callbacks.onError(parsed.message);
        return;
      default:
        return;
    }
  }

  private handleDrop(socket: SttSocket): void {
    if (socket !== this.socket) return;
    this.socket = null;
    socket.removeAllListeners();
    socket.on("error", () => undefined);
    if (this.closing) return;
    if (this.fatalReason) return this.giveUp(this.fatalReason);
    this.scheduleReconnect();
  }

  private giveUp(reason: string): void {
    this.replay.clear();
    this.callbacks.onFatal(reason);
    this.setStatus("closed");
  }

  private scheduleReconnect(): void {
    this.attempt += 1;
    if (this.attempt > this.reconnect.maxAttempts) {
      this.giveUp("AssemblyAI connection lost; giving up");
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
}
