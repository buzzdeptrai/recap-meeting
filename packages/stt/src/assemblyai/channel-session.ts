import { FRAME_MS, type Channel } from "@recap/core";
import WebSocket from "ws";
import { computeBackoffMs } from "../deepgram/backoff";
import type { SocketFactory, SttSocket } from "../deepgram/provider";
import { ReplayBuffer } from "../deepgram/replay-buffer";
import { rmsLevel } from "../audio-level";
import { SilenceGate } from "../silence-gate";
import type { SttChannelState, SttResult, SttStatus } from "../types";
import {
  ASSEMBLYAI_DEFAULTS,
  DEFAULT_RECONNECT,
  retryDelayMs,
  type AssemblyAiConfig,
  type ReconnectConfig,
} from "./config";
import { endStream } from "./end-stream";
import { parseAssemblyAiMessage } from "./parse";
import { buildStreamUrl } from "./url";

export interface ChannelCallbacks {
  onResult: (isFinal: boolean, result: SttResult) => void;
  onStatus: (status: SttStatus) => void;
  /** Non-fatal vendor error text. */
  onError: (message: string) => void;
  /** The channel gave up reconnecting. */
  onFatal: (message: string) => void;
  /** Idle = the channel is parked (socket closed or about to be) and must not count for status. */
  onIdleChange: (idle: boolean) => void;
  onActivity: (state: SttChannelState) => void;
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
  private readonly gate: SilenceGate | null;
  /** True from the gate parking the channel until a socket is open again. */
  private sleeping = false;
  private idleClose: Promise<void> | null = null;
  private rateLimited = false;
  private readonly closeTimeoutMs: number;
  private sentFrames = 0;

  constructor(
    readonly channel: Channel,
    private readonly config: AssemblyAiConfig,
    private readonly createSocket: SocketFactory,
    private readonly random: () => number,
    private readonly callbacks: ChannelCallbacks,
  ) {
    this.reconnect = { ...DEFAULT_RECONNECT, ...config.reconnect };
    this.replay = new ReplayBuffer(this.reconnect.replayBufferFrames);
    this.closeTimeoutMs = config.closeTimeoutMs ?? ASSEMBLYAI_DEFAULTS.closeTimeoutMs;
    const idleAfterMs = config.idleAfterMs ?? 0;
    this.gate = idleAfterMs > 0 ? new SilenceGate({ idleAfterMs }) : null;
  }

  /** Frames sent to the vendor since the last call (billing). */
  takeSentFrames(): number {
    const sent = this.sentFrames;
    this.sentFrames = 0;
    return sent;
  }

  get bufferedFrames(): number {
    return this.replay.size;
  }

  async open(): Promise<void> {
    this.closing = false;
    this.resetIdle();
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
    if (this.status === "closed" && !this.sleeping) return;
    if (!this.gate) return this.deliver(index, data);
    const out = this.gate.process({ index, data }, rmsLevel(data));
    if (out.transition === "idle") this.enterIdle();
    if (out.transition === "wake") this.wake();
    for (const frame of out.send) this.deliver(frame.index, frame.data);
  }

  private deliver(index: number, data: Uint8Array): void {
    // Sleeping = old socket terminating: park frames for the next socket.
    if (!this.sleeping && this.status === "open" && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(data);
      this.sentFrames += 1;
      return;
    }
    this.replay.push({ index, data });
  }

  private resetIdle(): void {
    this.gate?.reset();
    this.sleeping = false;
    this.idleClose = null;
    this.rateLimited = false;
  }

  /** Parks the channel: Terminate cleanly (finals still arrive), no reconnect, no failure status. */
  private enterIdle(): void {
    this.sleeping = true;
    this.callbacks.onIdleChange(true);
    this.callbacks.onActivity("idle");
    this.clearReconnectTimer();
    this.replay.clear();
    const socket = this.socket;
    if (!socket) return this.setStatus("closed");
    if (socket.readyState !== WebSocket.OPEN) {
      socket.terminate();
      this.socket = null;
      return this.setStatus("closed");
    }
    this.idleClose = endStream(socket, this.closeTimeoutMs).then(() => {
      if (this.socket === socket) this.socket = null;
      this.idleClose = null;
      this.setStatus("closed");
    });
  }

  /** Speech again: reconnect (frames wait in the replay buffer; backoff + rate limit apply). */
  private wake(): void {
    this.callbacks.onActivity("active");
    this.attempt = 0;
    const start = () => {
      if (this.closing || !this.sleeping) return;
      this.setStatus("connecting");
      this.connectSocket().catch(() => {
        if (!this.closing) this.scheduleReconnect();
      });
    };
    if (this.idleClose) void this.idleClose.then(start);
    else start();
  }

  /** Sends Terminate, keeps reading until the server finishes, then closes the socket. */
  async close(): Promise<void> {
    this.closing = true;
    await this.idleClose;
    this.clearReconnectTimer();
    this.replay.clear();
    const socket = this.socket;
    if (socket && socket.readyState === WebSocket.OPEN)
      await endStream(socket, this.closeTimeoutMs);
    else socket?.terminate();
    this.socket = null;
    this.resetIdle();
    this.setStatus("closed");
  }

  abort(): void {
    this.closing = true;
    this.clearReconnectTimer();
    this.replay.clear();
    this.socket?.removeAllListeners();
    this.socket?.on("error", () => undefined);
    this.socket?.terminate();
    this.socket = null;
    this.resetIdle();
    this.setStatus("closed");
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
  private setStatus(next: SttStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.callbacks.onStatus(next);
  }

  private connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
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
    this.sentFrames += pending.length;
    this.setStatus("open");
    if (!this.sleeping) return;
    this.sleeping = false;
    this.callbacks.onIdleChange(false);
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
        if (parsed.rateLimited) this.rateLimited = true;
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
    if (this.closing || this.sleeping) return;
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
    const backoff = computeBackoffMs(this.attempt, this.reconnect, this.random);
    const delay = retryDelayMs(this.config, backoff, this.rateLimited);
    this.rateLimited = false;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectSocket().catch(() => {
        if (!this.closing) this.scheduleReconnect();
      });
    }, delay);
  }
}
