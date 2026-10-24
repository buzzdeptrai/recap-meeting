import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeepgramProvider,
  type DeepgramConfig,
  type SttError,
  type SttResult,
  type SttSocket,
  type SttStatus,
} from "../src";

const OPEN = 1;
const CLOSED = 3;

class FakeSocket extends EventEmitter {
  readyState = 0;
  sent: Array<string | Uint8Array> = [];
  terminated = false;
  constructor(
    readonly url: string,
    readonly headers: Record<string, string>,
  ) {
    super();
  }
  send(data: string | Uint8Array) {
    this.sent.push(data);
  }
  close() {
    this.readyState = CLOSED;
    this.emit("close", 1000);
  }
  terminate() {
    this.terminated = true;
    this.readyState = CLOSED;
    this.emit("close", 1006);
  }
  open() {
    this.readyState = OPEN;
    this.emit("open");
  }
  drop() {
    this.readyState = CLOSED;
    this.emit("close", 1006);
  }
  audio() {
    return this.sent.filter((item): item is Uint8Array => typeof item !== "string");
  }
  text() {
    return this.sent.filter((item): item is string => typeof item === "string");
  }
}

const config: DeepgramConfig = { apiKey: "k-123", model: "nova-3", language: "vi" };
const frame = (n: number) => new Uint8Array([n]);

function setup(overrides: Partial<DeepgramConfig> = {}) {
  const sockets: FakeSocket[] = [];
  const provider = new DeepgramProvider(
    { ...config, ...overrides },
    {
      random: () => 0,
      createSocket: (url, headers) => {
        const socket = new FakeSocket(url, headers);
        sockets.push(socket);
        return socket as unknown as SttSocket;
      },
    },
  );
  const statuses: SttStatus[] = [];
  const finals: SttResult[] = [];
  const errors: SttError[] = [];
  provider.on("status", (s) => statuses.push(s));
  provider.on("final", (r) => finals.push(r));
  provider.on("error", (e) => errors.push(e));
  return { provider, sockets, statuses, finals, errors };
}

async function openProvider(ctx: ReturnType<typeof setup>) {
  const opening = ctx.provider.open();
  ctx.sockets[0]?.open();
  await opening;
  return ctx.sockets[0] as FakeSocket;
}

const finalMessage = (start: number) =>
  JSON.stringify({
    type: "Results",
    channel_index: [0, 2],
    start,
    duration: 0.5,
    is_final: true,
    channel: { alternatives: [{ transcript: "xin chào các bạn" }] },
  });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("DeepgramProvider connection", () => {
  it("authenticates by header and opens", async () => {
    const ctx = setup();
    const socket = await openProvider(ctx);
    expect(socket.headers).toEqual({ Authorization: "Token k-123" });
    expect(socket.url).not.toContain("k-123");
    expect(ctx.statuses).toEqual(["connecting", "open"]);
  });

  it("rejects open() when the first connection fails", async () => {
    const ctx = setup();
    const opening = ctx.provider.open();
    ctx.sockets[0]?.drop();
    await expect(opening).rejects.toThrow(/closed/);
    expect(ctx.statuses).toEqual(["connecting", "closed"]);
  });

  it("sends KeepAlive every 8 s", async () => {
    const ctx = setup();
    const socket = await openProvider(ctx);
    vi.advanceTimersByTime(8000 * 2);
    expect(socket.text()).toEqual(['{"type":"KeepAlive"}', '{"type":"KeepAlive"}']);
  });

  it("sends audio straight through while open and parses results", async () => {
    const ctx = setup();
    const socket = await openProvider(ctx);
    ctx.provider.sendAudio(frame(1));
    expect(socket.audio()).toEqual([frame(1)]);
    socket.emit("message", finalMessage(0.5));
    expect(ctx.finals).toMatchObject([{ channel: 0, text: "xin chào các bạn", startMs: 500 }]);
  });

  it("close() sends CloseStream, delivers trailing finals, then closes", async () => {
    const ctx = setup();
    const socket = await openProvider(ctx);
    const closing = ctx.provider.close();
    expect(socket.text()).toContain('{"type":"CloseStream"}');
    socket.emit("message", finalMessage(1));
    socket.close();
    await closing;
    expect(ctx.finals).toHaveLength(1);
    expect(ctx.statuses.at(-1)).toBe("closed");
  });

  it("close() terminates after the close timeout", async () => {
    const ctx = setup({ closeTimeoutMs: 500 });
    const socket = await openProvider(ctx);
    const closing = ctx.provider.close();
    vi.advanceTimersByTime(500);
    await closing;
    expect(socket.terminated).toBe(true);
  });
});

describe("DeepgramProvider reconnect", () => {
  it("reconnects with backoff, replays buffered audio and offsets timestamps", async () => {
    const ctx = setup();
    const first = await openProvider(ctx);
    for (const n of [0, 1, 2]) ctx.provider.sendAudio(frame(n));
    first.drop();
    expect(ctx.statuses.at(-1)).toBe("reconnecting");
    for (const n of [3, 4]) ctx.provider.sendAudio(frame(n));
    expect(ctx.provider.bufferedFrames).toBe(2);

    vi.advanceTimersByTime(499);
    expect(ctx.sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(ctx.sockets).toHaveLength(2);
    ctx.sockets[1]?.open();

    expect(ctx.sockets[1]?.audio()).toEqual([frame(3), frame(4)]);
    expect(ctx.statuses.at(-1)).toBe("open");
    expect(ctx.provider.bufferedFrames).toBe(0);
    // Deepgram restarts its clock: 0.1 s on the new socket = frame 3 + 100 ms = 400 ms.
    ctx.sockets[1]?.emit("message", finalMessage(0.1));
    expect(ctx.finals[0]?.startMs).toBe(400);
  });

  it("keeps only the newest frames when the replay buffer overflows", async () => {
    const ctx = setup({ reconnect: { replayBufferFrames: 2 } });
    const first = await openProvider(ctx);
    first.drop();
    for (const n of [0, 1, 2, 3]) ctx.provider.sendAudio(frame(n));
    vi.advanceTimersByTime(500);
    ctx.sockets[1]?.open();
    expect(ctx.sockets[1]?.audio()).toEqual([frame(2), frame(3)]);
    ctx.sockets[1]?.emit("message", finalMessage(0));
    expect(ctx.finals[0]?.startMs).toBe(200);
  });

  it("retries failed reconnects and gives up after maxAttempts", async () => {
    const ctx = setup({ reconnect: { maxAttempts: 2 } });
    const first = await openProvider(ctx);
    first.drop();
    vi.advanceTimersByTime(500);
    ctx.sockets[1]?.drop();
    await vi.advanceTimersByTimeAsync(1000);
    ctx.sockets[2]?.drop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ctx.sockets).toHaveLength(3);
    expect(ctx.statuses.at(-1)).toBe("closed");
    expect(ctx.errors).toEqual([expect.objectContaining({ fatal: true })]);
  });

  it("resets the attempt counter after a successful reconnect", async () => {
    const ctx = setup({ reconnect: { maxAttempts: 1 } });
    const first = await openProvider(ctx);
    first.drop();
    vi.advanceTimersByTime(500);
    ctx.sockets[1]?.open();
    ctx.sockets[1]?.drop();
    vi.advanceTimersByTime(500);
    expect(ctx.sockets).toHaveLength(3);
    expect(ctx.errors).toHaveLength(0);
  });

  it("does not reconnect after close()", async () => {
    const ctx = setup();
    const socket = await openProvider(ctx);
    const closing = ctx.provider.close();
    socket.close();
    await closing;
    vi.advanceTimersByTime(60_000);
    expect(ctx.sockets).toHaveLength(1);
  });

  it("does not resurrect the stream when close() runs during an in-flight reconnect", async () => {
    const ctx = setup();
    const first = await openProvider(ctx);
    first.drop();
    vi.advanceTimersByTime(500);
    expect(ctx.sockets).toHaveLength(2);
    await ctx.provider.close();
    ctx.sockets[1]?.open();
    expect(ctx.sockets[1]?.terminated).toBe(true);
    expect(ctx.statuses.at(-1)).toBe("closed");
    vi.advanceTimersByTime(60_000);
    expect(ctx.sockets[1]?.text()).toEqual([]);
    expect(ctx.sockets).toHaveLength(2);
  });
});
