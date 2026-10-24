import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import {
  AssemblyAiProvider,
  type AssemblyAiConfig,
  type SttChannelActivity,
  type SttError,
  type SttResult,
  type SttStatus,
} from "../src";

const LEFT = 0x11;
const RIGHT = 0x22;
const LOUD_HI = 0x20; // sample 0x20xx = 0.25 of full scale
const WAIT_MS = 3000;
const IDLE_AFTER_MS = 300; // 3 frames of silence
const PRE_ROLL_FRAMES = 15;
const FRAME_MS = 100;

interface Conn {
  ws: WebSocket;
  audio: Uint8Array[];
  text: string[];
}

/** Local AssemblyAI look-alike that closes on Terminate and can refuse connections. */
class FakeServer {
  readonly conns: Conn[] = [];
  refuseNext = 0;

  private constructor(readonly wss: WebSocketServer) {
    wss.on("connection", (ws) => {
      if (this.refuseNext > 0) {
        this.refuseNext -= 1;
        ws.send('{"type":"Error","error_code":1008,"error":"Too many concurrent sessions"}');
        ws.close(1008);
        return;
      }
      const conn: Conn = { ws, audio: [], text: [] };
      ws.on("message", (data, isBinary) => {
        if (isBinary) return void conn.audio.push(new Uint8Array(data as Buffer));
        conn.text.push(String(data));
        if (String(data).includes("Terminate")) ws.close(1000);
      });
      this.conns.push(conn);
      ws.send(JSON.stringify({ type: "Begin", id: "s" }));
    });
  }

  static async start(): Promise<FakeServer> {
    const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    await new Promise((resolve) => wss.once("listening", resolve));
    return new FakeServer(wss);
  }

  get url(): string {
    return `ws://127.0.0.1:${(this.wss.address() as AddressInfo).port}/v3/ws`;
  }

  /** Connections whose audio carries this channel's marker byte (latest last). */
  forChannel(channel: 0 | 1): Conn[] {
    const marker = channel === 0 ? LEFT : RIGHT;
    return this.conns.filter((c) => c.audio[0]?.[0] === marker);
  }

  async stop(): Promise<void> {
    for (const client of this.wss.clients) client.terminate();
    await new Promise((resolve) => this.wss.close(resolve));
  }
}

let seq = 0;
/** One stereo frame (2 samples). Left marker + sequence number travel in the low bytes. */
function frame(leftLoud: boolean, rightLoud: boolean): Uint8Array {
  const n = seq++;
  const lh = leftLoud ? LOUD_HI : 0;
  const rh = rightLoud ? LOUD_HI : 0;
  return new Uint8Array([LEFT, lh, RIGHT, rh, n, lh, n, rh]);
}
const seqOf = (audio: Uint8Array) => audio[2] as number;

async function until(check: () => unknown): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let server: FakeServer;
const providers: AssemblyAiProvider[] = [];

async function setup(overrides: Partial<AssemblyAiConfig> = {}) {
  seq = 0; // provider frame indexes restart per provider
  server = await FakeServer.start();
  const provider = new AssemblyAiProvider(
    {
      apiKey: "k",
      model: "m",
      language: "multi",
      baseUrl: server.url,
      reconnect: { baseDelayMs: 5, maxDelayMs: 10, maxAttempts: 3 },
      closeTimeoutMs: 200,
      idleAfterMs: IDLE_AFTER_MS,
      rateLimitRetryMs: 20,
      ...overrides,
    },
    { random: () => 0 },
  );
  providers.push(provider);
  const statuses: SttStatus[] = [];
  const finals: SttResult[] = [];
  const errors: SttError[] = [];
  const activity: SttChannelActivity[] = [];
  provider.on("status", (s) => statuses.push(s));
  provider.on("final", (r) => finals.push(r));
  provider.on("error", (e) => errors.push(e));
  provider.on("activity", (a) => activity.push(a));
  await provider.open();
  provider.sendAudio(frame(true, true));
  await until(() => server.forChannel(0).length === 1 && server.forChannel(1).length === 1);
  return { provider, statuses, finals, errors, activity };
}

const send = (p: AssemblyAiProvider, count: number, left: boolean, right: boolean) => {
  for (let i = 0; i < count; i += 1) p.sendAudio(frame(left, right));
};

afterEach(async () => {
  await Promise.all(providers.splice(0).map((p) => p.close()));
  await server?.stop();
});

describe("AssemblyAI silence gating", () => {
  it("parks only the silent channel with a clean Terminate and no failure status", async () => {
    const ctx = await setup();
    send(ctx.provider, 3, false, true);
    await until(() => ctx.activity.length === 1);
    expect(ctx.activity[0]).toEqual({ channel: 0, state: "idle" });
    const [mic] = server.forChannel(0);
    const [tab] = server.forChannel(1);
    await until(() => mic?.text.includes('{"type":"Terminate"}'));
    await until(() => mic?.ws.readyState === WebSocket.CLOSED);
    send(ctx.provider, 5, false, true);
    await pause(60);
    expect(tab?.text).toEqual([]);
    expect(tab?.ws.readyState).toBe(WebSocket.OPEN);
    expect(server.conns).toHaveLength(2); // no reconnect storm
    expect(ctx.statuses).toEqual(["connecting", "open"]);
    expect(ctx.errors).toEqual([]);
  });

  it("wakes on speech, reopens, flushes the pre-roll first and offsets timestamps", async () => {
    const ctx = await setup();
    send(ctx.provider, 3, false, false); // both channels go idle
    await until(() => server.forChannel(0)[0]?.ws.readyState === WebSocket.CLOSED);
    const silentFrames = 25;
    send(ctx.provider, silentFrames, false, false);
    const wakeSeq = seq;
    ctx.provider.sendAudio(frame(true, false)); // only the mic wakes
    await until(() => server.forChannel(0).length === 2);
    const fresh = server.forChannel(0)[1] as Conn;
    await until(() => fresh.audio.length === PRE_ROLL_FRAMES + 1);
    const seqs = fresh.audio.map(seqOf);
    expect(seqs.at(-1)).toBe(wakeSeq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(seqs[0]).toBe(wakeSeq - PRE_ROLL_FRAMES);
    expect(server.forChannel(1)).toHaveLength(1); // the tab stays parked
    // the new socket's clock starts at its first (pre-roll) frame
    fresh.ws.send(
      JSON.stringify({
        type: "Turn",
        transcript: "hi",
        end_of_turn: true,
        turn_is_formatted: true,
        words: [{ text: "hi", start: 100, end: 300, confidence: 1 }],
      }),
    );
    await until(() => ctx.finals.length === 1);
    const firstFrameMs = (wakeSeq - PRE_ROLL_FRAMES) * FRAME_MS;
    expect(ctx.finals[0]).toMatchObject({ channel: 0, startMs: firstFrameMs + 100 });
    expect(ctx.activity.map((a) => `${a.channel}:${a.state}`)).toEqual([
      "0:idle",
      "1:idle",
      "0:active",
    ]);
    await until(() => ctx.statuses.at(-1) === "open");
    expect(ctx.statuses).not.toContain("closed");
  });

  it("keeps channels independent: the active channel streams every frame on one socket", async () => {
    const ctx = await setup();
    send(ctx.provider, 10, false, true);
    await until(() => server.forChannel(0)[0]?.ws.readyState === WebSocket.CLOSED);
    send(ctx.provider, 3, true, true);
    await until(() => server.forChannel(0).length === 2);
    const tabAudio = server.forChannel(1)[0]?.audio ?? [];
    await until(() => (server.forChannel(1)[0]?.audio.length ?? 0) === 1 + 10 + 3);
    expect(tabAudio.map(seqOf)).toEqual([...tabAudio.map(seqOf)].sort((a, b) => a - b));
    expect(server.forChannel(1)).toHaveLength(1);
  });

  it("reports only frames actually sent, so idle time is not billed", async () => {
    const ctx = await setup();
    const usage = ctx.provider.usage;
    expect(usage).toBeDefined();
    const sentSoFar = () => server.conns.reduce((n, c) => n + c.audio.length, 0);
    await until(() => sentSoFar() === 2);
    expect(usage?.takeSentChannelFrames()).toBe(2); // first stereo frame = 2 channel-frames
    send(ctx.provider, 3, false, false);
    await until(() => ctx.activity.length === 2);
    const afterIdle = usage?.takeSentChannelFrames() ?? 0;
    send(ctx.provider, 50, false, false);
    await pause(30);
    expect(usage?.takeSentChannelFrames()).toBe(0);
    expect(afterIdle).toBeLessThanOrEqual(4); // the frames before the window closed
  });

  it("retries a wake that hits the session-start limit, keeping the channel parked-looking", async () => {
    const ctx = await setup();
    send(ctx.provider, 3, false, true);
    await until(() => server.forChannel(0)[0]?.ws.readyState === WebSocket.CLOSED);
    server.refuseNext = 1;
    send(ctx.provider, 1, true, true);
    for (let i = 0; i < 20 && server.forChannel(0).length < 2; i += 1) {
      await pause(30);
      send(ctx.provider, 1, true, true);
    }
    await until(() => server.forChannel(0).length === 2);
    expect(ctx.errors.filter((e) => e.fatal)).toEqual([]);
    expect(ctx.statuses.at(-1)).not.toBe("closed");
  });

  it("streams everything and exposes no usage hook when gating is off", async () => {
    const ctx = await setup({ idleAfterMs: undefined });
    expect(ctx.provider.usage).toBeUndefined();
    send(ctx.provider, 20, false, false);
    await until(() => (server.forChannel(0)[0]?.audio.length ?? 0) === 21);
    expect(server.conns).toHaveLength(2);
    expect(ctx.activity).toEqual([]);
  });
});

describe("AssemblyAI frames during the Terminate window", () => {
  it("parks frames for the new socket instead of sending them to the terminating one", async () => {
    const ctx = await setup({ closeTimeoutMs: 1000 });
    const [mic] = server.forChannel(0);
    // Delay the server's close so the old socket stays OPEN after Terminate.
    mic?.ws.removeAllListeners("message");
    let afterTerminate = 0;
    let terminated = false;
    mic?.ws.on("message", (data, isBinary) => {
      if (isBinary) {
        mic.audio.push(new Uint8Array(data as Buffer));
        if (terminated) afterTerminate += 1;
        return;
      }
      if (String(data).includes("Terminate")) {
        terminated = true;
        setTimeout(() => mic.ws.close(1000), 300);
      }
    });
    send(ctx.provider, 3, false, true); // mic goes idle, Terminate sent
    await until(() => terminated);
    send(ctx.provider, 4, true, true); // speech returns inside the window
    await until(() => server.forChannel(0).length === 2);
    const fresh = server.forChannel(0)[1] as Conn;
    await until(() => fresh.audio.length >= 4);
    expect(afterTerminate).toBe(0);
    const seqs = fresh.audio.map(seqOf);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    // metering counts only frames really sent: every sent frame was received by some socket
    const received = server.conns.reduce((t, c) => t + c.audio.length, 0);
    await pause(50);
    const metered = ctx.provider.usage?.takeSentChannelFrames() ?? 0;
    expect(metered).toBeLessThanOrEqual(received);
  });
});
