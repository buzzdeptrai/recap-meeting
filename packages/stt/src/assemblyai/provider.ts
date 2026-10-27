import { CHANNEL_ME, CHANNEL_OTHERS, type Channel } from "@recap/core";
import WebSocket from "ws";
import type { DeepgramDeps, SocketFactory } from "../deepgram/provider";
import { SttEmitter } from "../emitter";
import type { SttProvider, SttStatus, SttUsageSource } from "../types";
import { ChannelSession } from "./channel-session";
import type { AssemblyAiConfig } from "./config";
import { splitStereo } from "./split-stereo";

export type AssemblyAiDeps = DeepgramDeps;

const defaultSocketFactory: SocketFactory = (url, headers) => new WebSocket(url, { headers });

/**
 * AssemblyAI streaming has no multichannel mode (the docs recommend one session per channel), so
 * each stereo frame is split into two mono streams and sent over two sockets. Both sockets are
 * merged into the single `SttProvider` surface; results carry the channel of their socket.
 * Sessions are billed per connection second, so sockets are closed as soon as the stream ends.
 */
export class AssemblyAiProvider extends SttEmitter implements SttProvider {
  readonly name = "assemblyai";
  private readonly sessions: Record<Channel, ChannelSession>;
  private readonly statuses: Record<Channel, SttStatus> = {
    [CHANNEL_ME]: "closed",
    [CHANNEL_OTHERS]: "closed",
  };
  /** Channels parked by the silence gate (or waking up): they do not count for the merged status. */
  private readonly idle: Record<Channel, boolean> = {
    [CHANNEL_ME]: false,
    [CHANNEL_OTHERS]: false,
  };
  /** Set only when silence gating is on: billing then follows the frames actually sent. */
  readonly usage?: SttUsageSource;
  private status: SttStatus = "closed";
  private frameCounter = 0;
  /** True once close()/fatal/failed-open began: per-socket status changes no longer matter. */
  private ending = false;

  constructor(config: AssemblyAiConfig, deps: AssemblyAiDeps = {}) {
    super();
    const createSocket = deps.createSocket ?? defaultSocketFactory;
    const random = deps.random ?? Math.random;
    const make = (channel: Channel) =>
      new ChannelSession(channel, config, createSocket, random, {
        onResult: (isFinal, result) => this.emit(isFinal ? "final" : "interim", result),
        onStatus: (status) => this.onChannelStatus(channel, status),
        onError: (message) => this.emit("error", { message, fatal: false }),
        onFatal: (message) => this.onChannelFatal(message),
        onIdleChange: (idle) => this.onChannelIdle(channel, idle),
        onActivity: (state) => this.emit("activity", { channel, state }),
      });
    this.sessions = { [CHANNEL_ME]: make(CHANNEL_ME), [CHANNEL_OTHERS]: make(CHANNEL_OTHERS) };
    if (config.idleAfterMs && config.idleAfterMs > 0) {
      this.usage = {
        takeSentChannelFrames: () =>
          this.all().reduce((total, session) => total + session.takeSentFrames(), 0),
      };
    }
  }

  /** Frames waiting for a connection, summed over both channels (tests / diagnostics). */
  get bufferedFrames(): number {
    return this.all().reduce((total, session) => total + session.bufferedFrames, 0);
  }

  async open(): Promise<void> {
    this.ending = false;
    this.idle[CHANNEL_ME] = false;
    this.idle[CHANNEL_OTHERS] = false;
    this.setStatus("connecting");
    const results = await Promise.allSettled(this.all().map((session) => session.open()));
    const rejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (!rejected) return;
    this.ending = true;
    this.all().forEach((session) => session.abort());
    this.setStatus("closed");
    throw rejected.reason instanceof Error ? rejected.reason : new Error("AssemblyAI open failed");
  }

  sendAudio(frame: Uint8Array): void {
    const index = this.frameCounter++;
    if (this.status === "closed") return;
    const [mic, others] = splitStereo(frame);
    this.sessions[CHANNEL_ME].send(index, mic);
    this.sessions[CHANNEL_OTHERS].send(index, others);
  }

  async close(): Promise<void> {
    this.ending = true;
    await Promise.all(this.all().map((session) => session.close()));
    this.setStatus("closed");
  }

  private all(): ChannelSession[] {
    return [this.sessions[CHANNEL_ME], this.sessions[CHANNEL_OTHERS]];
  }

  private onChannelStatus(channel: Channel, status: SttStatus): void {
    this.statuses[channel] = status;
    if (this.ending) return;
    if (status === "reconnecting") this.emit("activity", { channel, state: "reconnecting" });
    this.setStatus(this.mergedStatus());
  }

  private onChannelIdle(channel: Channel, idle: boolean): void {
    this.idle[channel] = idle;
    if (!this.ending) this.setStatus(this.mergedStatus());
  }

  /**
   * open only when both sockets are open; any reconnecting socket shows as reconnecting. Idle
   * channels are left out (parking a silent channel is not a failure); all idle = still open.
   */
  private mergedStatus(): SttStatus {
    const values = ([CHANNEL_ME, CHANNEL_OTHERS] as const)
      .filter((channel) => !this.idle[channel])
      .map((channel) => this.statuses[channel]);
    if (values.length === 0) return "open";
    if (values.every((s) => s === "closed")) return "closed";
    if (values.includes("reconnecting")) return "reconnecting";
    if (values.every((s) => s === "open")) return "open";
    return "connecting";
  }

  private onChannelFatal(message: string): void {
    if (this.ending) return;
    this.ending = true;
    this.all().forEach((session) => session.abort());
    this.setStatus("closed");
    this.emit("error", { message, fatal: true });
  }

  private setStatus(next: SttStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.emit("status", next);
  }
}
