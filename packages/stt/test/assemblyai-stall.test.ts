import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { AssemblyAiProvider, type AssemblyAiConfig, type SttError, type SttStatus } from "../src";
import { buildStreamUrl } from "../src/assemblyai/url";
import type { SttSocket } from "../src/deepgram/provider";

const STALL_MS = 15_000;
const HEARTBEAT_MS = 5_000;
const IDLE_AFTER_MS = 300;
const HEARTBEAT = JSON.stringify({ type: "Heartbeat", total_audio_received_ms: 0 });

class FakeSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  sent: unknown[] = [];
  terminated = 0;
  send(data: unknown): void {
    this.sent.push(data);
    if (String(data).includes("Terminate")) this.emit("close", 1000);
  }
  close(): void {
    this.emit("close", 1000);
  }
  terminate(): void {
    this.terminated += 1;
    this.readyState = WebSocket.CLOSED;
    this.emit("close", 1006);
  }
}

const frame = (hi: number) => new Uint8Array([0, hi, 0, hi, 1, hi, 1, hi]);
const silent = () => frame(0);
const loud = () => frame(0x20);

let sockets: FakeSocket[];
let provider: AssemblyAiProvider | undefined;
let statuses: SttStatus[];
let errors: SttError[];

async function setup(overrides: Partial<AssemblyAiConfig> = {}) {
  sockets = [];
  const createSocket = () => {
    const socket = new FakeSocket();
    sockets.push(socket);
    queueMicrotask(() => socket.emit("open"));
    return socket as unknown as SttSocket;
  };
  provider = new AssemblyAiProvider(
    {
      apiKey: "k",
      model: "m",
      language: "multi",
      reconnect: { baseDelayMs: 5, maxDelayMs: 10, maxAttempts: 3 },
      closeTimeoutMs: 200,
      ...overrides,
    },
    { createSocket, random: () => 0 },
  );
  statuses = [];
  errors = [];
  provider.on("status", (s) => statuses.push(s));
  provider.on("error", (e) => errors.push(e));
  await provider.open();
}

const beat = (socket: FakeSocket) => socket.emit("message", Buffer.from(HEARTBEAT));
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => vi.useFakeTimers());
afterEach(async () => {
  await provider?.close();
  provider = undefined;
  vi.useRealTimers();
});

describe("AssemblyAI stall watchdog", () => {
  it("asks the server for heartbeats", () => {
    const url = buildStreamUrl({ apiKey: "k", model: "m", language: "multi" });
    expect(url).toContain("session_heartbeat=true");
    const off = buildStreamUrl({ apiKey: "k", model: "m", language: "multi", stallTimeoutMs: 0 });
    expect(off).not.toContain("session_heartbeat");
  });

  it("reconnects a hung socket exactly once", async () => {
    await setup();
    expect(sockets).toHaveLength(2);
    beat(sockets[1] as FakeSocket); // tab stays alive; mic is silent
    await advance(HEARTBEAT_MS * 2);
    beat(sockets[1] as FakeSocket);
    await advance(STALL_MS - HEARTBEAT_MS * 2 + 1);
    expect((sockets[0] as FakeSocket).terminated).toBe(1);
    expect(statuses).toContain("reconnecting");
    expect(errors.some((e) => e.message.includes("stalled") && !e.fatal)).toBe(true);
    await advance(100);
    expect(sockets).toHaveLength(3); // one new mic socket, tab untouched
    await advance(STALL_MS * 3);
    expect(sockets.length).toBeGreaterThanOrEqual(3);
    expect((sockets[0] as FakeSocket).terminated).toBe(1);
  });

  it("reports which channel is reconnecting so its unfinished turn can be flushed", async () => {
    await setup();
    const activity: unknown[] = [];
    provider?.on("activity", (a) => activity.push(a));
    beat(sockets[1] as FakeSocket);
    await advance(HEARTBEAT_MS * 2);
    beat(sockets[1] as FakeSocket);
    await advance(STALL_MS - HEARTBEAT_MS * 2 + 1);
    expect(activity).toEqual([{ channel: 0, state: "reconnecting" }]);
  });

  it("replays audio sent while reconnecting to the new socket", async () => {
    await setup();
    await advance(STALL_MS + 1);
    provider?.sendAudio(loud());
    await advance(50);
    expect(sockets.length).toBeGreaterThanOrEqual(3);
    expect((sockets[2] as FakeSocket).sent.length).toBeGreaterThan(0);
  });

  it("any inbound message keeps the session alive", async () => {
    await setup();
    for (let i = 0; i < 10; i += 1) {
      await advance(HEARTBEAT_MS);
      sockets.forEach(beat);
    }
    expect(sockets).toHaveLength(2);
    expect(sockets.every((s) => s.terminated === 0)).toBe(true);
    expect(statuses).not.toContain("reconnecting");
  });

  it("does not reconnect a channel parked by the silence gate", async () => {
    await setup({ idleAfterMs: IDLE_AFTER_MS });
    for (let i = 0; i < 4; i += 1) provider?.sendAudio(silent()); // both channels park
    await advance(10);
    await advance(STALL_MS * 4);
    expect(sockets).toHaveLength(2);
    expect(statuses).not.toContain("reconnecting");
    expect(errors).toEqual([]);
  });

  it("stops the watchdog on close", async () => {
    await setup();
    await provider?.close();
    await advance(STALL_MS * 4);
    expect(sockets).toHaveLength(2);
    expect(errors).toEqual([]);
    expect(statuses).not.toContain("reconnecting");
  });

  it("can be disabled with stallTimeoutMs 0", async () => {
    await setup({ stallTimeoutMs: 0 });
    await advance(STALL_MS * 4);
    expect(sockets).toHaveLength(2);
  });
});
