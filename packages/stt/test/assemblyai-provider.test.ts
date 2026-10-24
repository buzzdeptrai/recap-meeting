import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import {
  AssemblyAiProvider,
  createSttProvider,
  type AssemblyAiConfig,
  type SttError,
  type SttResult,
  type SttStatus,
} from "../src";

const LEFT = 0x11;
const RIGHT = 0x22;
const WAIT_MS = 3000;

/** Local AssemblyAI v3 look-alike. Connections are told apart by the audio they receive. */
class FakeAssemblyAi {
  readonly wss: WebSocketServer;
  readonly conns: Conn[] = [];
  headers: Array<Record<string, unknown>> = [];
  urls: string[] = [];

  private constructor(wss: WebSocketServer) {
    this.wss = wss;
    wss.on("connection", (ws, req) => {
      this.headers.push(req.headers);
      this.urls.push(req.url ?? "");
      const conn: Conn = { ws, audio: [], text: [] };
      ws.on("message", (data, isBinary) => {
        if (isBinary) conn.audio.push(new Uint8Array(data as Buffer));
        else {
          const message = String(data);
          conn.text.push(message);
          if (message.includes("Terminate")) conn.onTerminate?.();
        }
      });
      this.conns.push(conn);
      ws.send(JSON.stringify({ type: "Begin", id: "s" }));
    });
  }

  static async start(): Promise<FakeAssemblyAi> {
    const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    await new Promise((resolve) => wss.once("listening", resolve));
    return new FakeAssemblyAi(wss);
  }

  get url(): string {
    return `ws://127.0.0.1:${(this.wss.address() as AddressInfo).port}/v3/ws`;
  }

  /** Connections that have received audio, keyed by the channel their first byte identifies. */
  conn(channel: 0 | 1): Conn | undefined {
    const marker = channel === 0 ? LEFT : RIGHT;
    return this.conns.filter((c) => c.audio[0]?.[0] === marker).at(-1);
  }

  async stop(): Promise<void> {
    for (const client of this.wss.clients) client.terminate();
    await new Promise((resolve) => this.wss.close(resolve));
  }
}

interface Conn {
  ws: WebSocket;
  audio: Uint8Array[];
  text: string[];
  onTerminate?: () => void;
}

const stereo = (n = 0) => new Uint8Array([LEFT, n, RIGHT, n]);
const turn = (transcript: string, extra: Record<string, unknown>) =>
  JSON.stringify({
    type: "Turn",
    transcript,
    words: [{ text: transcript, start: 100, end: 600, confidence: 0.9 }],
    ...extra,
  });

async function until(check: () => unknown): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

let server: FakeAssemblyAi;
const providers: AssemblyAiProvider[] = [];

async function setup(overrides: Partial<AssemblyAiConfig> = {}) {
  server ??= await FakeAssemblyAi.start();
  const config: AssemblyAiConfig = {
    apiKey: "k-secret-123",
    model: "universal-3-6-pro",
    language: "multi",
    baseUrl: server.url,
    reconnect: { baseDelayMs: 5, maxDelayMs: 10, maxAttempts: 3 },
    closeTimeoutMs: 500,
    ...overrides,
  };
  const provider = new AssemblyAiProvider(config, { random: () => 0 });
  providers.push(provider);
  const statuses: SttStatus[] = [];
  const interims: SttResult[] = [];
  const finals: SttResult[] = [];
  const errors: SttError[] = [];
  provider.on("status", (s) => statuses.push(s));
  provider.on("interim", (r) => interims.push(r));
  provider.on("final", (r) => finals.push(r));
  provider.on("error", (e) => errors.push(e));
  return { provider, statuses, interims, finals, errors };
}

/** Opens and pushes one frame so both server connections can be identified. */
async function openAndIdentify(ctx: Awaited<ReturnType<typeof setup>>) {
  await ctx.provider.open();
  ctx.provider.sendAudio(stereo(0));
  await until(() => server.conn(0) && server.conn(1));
}

afterEach(async () => {
  await Promise.all(providers.splice(0).map((p) => p.close()));
  await server?.stop();
  server = undefined as unknown as FakeAssemblyAi;
});

describe("AssemblyAiProvider connection", () => {
  it("opens two authenticated sockets and splits stereo into mono per channel", async () => {
    const ctx = await setup();
    await openAndIdentify(ctx);
    expect(server.conns).toHaveLength(2);
    expect(server.headers.every((h) => h.authorization === "k-secret-123")).toBe(true);
    expect(server.urls.every((u) => !u.includes("k-secret-123"))).toBe(true);
    expect(server.urls[0]).toContain("speech_model=universal-3-6-pro");
    expect(server.urls[0]).not.toContain("language_codes");
    expect([...(server.conn(0)?.audio[0] ?? [])]).toEqual([LEFT, 0]);
    expect([...(server.conn(1)?.audio[0] ?? [])]).toEqual([RIGHT, 0]);
    expect(ctx.statuses).toEqual(["connecting", "open"]);
  });

  it("rejects open() and closes the other socket when one connection fails", async () => {
    const ctx = await setup({ baseUrl: "ws://127.0.0.1:1/v3/ws" });
    await expect(ctx.provider.open()).rejects.toThrow(/AssemblyAI/);
    expect(ctx.statuses).toEqual(["connecting", "closed"]);
  });
});

describe("AssemblyAiProvider results", () => {
  it("tags interim and final turns with the channel of their socket", async () => {
    const ctx = await setup();
    await openAndIdentify(ctx);
    server.conn(1)?.ws.send(turn("hello", { end_of_turn: false }));
    server
      .conn(0)
      ?.ws.send(
        turn("xin chào", { end_of_turn: true, turn_is_formatted: true, language_code: "vi" }),
      );
    await until(() => ctx.interims.length === 1 && ctx.finals.length === 1);
    expect(ctx.interims[0]).toMatchObject({ channel: 1, text: "hello", lang: null });
    expect(ctx.finals[0]).toMatchObject({
      channel: 0,
      text: "xin chào",
      lang: "vi",
      startMs: 100,
      endMs: 600,
    });
  });
});

describe("AssemblyAiProvider reconnect", () => {
  it("reconnects one channel, replays its buffered audio and offsets timestamps", async () => {
    // Slow backoff (~100 ms with zero jitter) so the "reconnecting" window is observable.
    const ctx = await setup({ reconnect: { baseDelayMs: 200, maxDelayMs: 200, maxAttempts: 3 } });
    await openAndIdentify(ctx);
    const old = server.conn(0);
    old?.ws.terminate();
    await until(() => ctx.statuses.at(-1) === "reconnecting");
    for (const n of [1, 2]) ctx.provider.sendAudio(stereo(n));
    await until(() => ctx.statuses.at(-1) === "open" && server.conns.length === 3);
    const fresh = server.conns.at(-1);
    await until(() => fresh?.audio.length === 2);
    expect(fresh?.audio.map((a) => a[1])).toEqual([1, 2]);
    // Socket clock restarts: 100 ms on the new socket = frame 1 (100 ms) + 100 ms = 200 ms.
    fresh?.ws.send(turn("again", { end_of_turn: true, turn_is_formatted: true }));
    await until(() => ctx.finals.length === 1);
    expect(ctx.finals[0]).toMatchObject({ channel: 0, startMs: 200 });
  });

  it("gives up after maxAttempts: fatal error, closed status, no leaked sockets", async () => {
    const ctx = await setup({ reconnect: { baseDelayMs: 5, maxDelayMs: 10, maxAttempts: 2 } });
    await openAndIdentify(ctx);
    const closedServer = server;
    await closedServer.stop();
    await until(() => ctx.errors.some((e) => e.fatal));
    expect(ctx.errors.filter((e) => e.fatal)).toHaveLength(1);
    expect(ctx.statuses.at(-1)).toBe("closed");
    server = undefined as unknown as FakeAssemblyAi;
  });

  it("fails fast on an unauthorized error instead of retrying", async () => {
    const ctx = await setup();
    await openAndIdentify(ctx);
    const conn = server.conn(1);
    conn?.ws.send(
      '{"type":"Error","error_code":1008,"error":"Unauthorized Connection: Insufficient funds"}',
    );
    conn?.ws.close(1008);
    await until(() => ctx.errors.some((e) => e.fatal));
    expect(server.conns).toHaveLength(2);
    expect(ctx.statuses.at(-1)).toBe("closed");
    expect(JSON.stringify(ctx.errors)).not.toContain("k-secret-123");
  });
});

describe("AssemblyAiProvider close", () => {
  it("sends Terminate, delivers trailing finals, then closes both sockets", async () => {
    const ctx = await setup();
    await openAndIdentify(ctx);
    for (const channel of [0, 1] as const) {
      const conn = server.conn(channel);
      if (!conn) throw new Error("missing connection");
      conn.onTerminate = () => {
        conn.ws.send(turn("last", { end_of_turn: true, turn_is_formatted: true }));
        conn.ws.send(
          '{"type":"Termination","audio_duration_seconds":1,"session_duration_seconds":1}',
        );
        conn.ws.close(1000);
      };
    }
    await ctx.provider.close();
    expect(server.conns.every((c) => c.text.includes('{"type":"Terminate"}'))).toBe(true);
    expect(ctx.finals.map((f) => f.channel).sort()).toEqual([0, 1]);
    expect(ctx.statuses.at(-1)).toBe("closed");
    expect(ctx.statuses.filter((s) => s === "closed")).toHaveLength(1);
  });

  it("terminates sockets that do not answer Terminate within closeTimeoutMs", async () => {
    const ctx = await setup({ closeTimeoutMs: 50 });
    await openAndIdentify(ctx);
    await ctx.provider.close();
    expect(ctx.statuses.at(-1)).toBe("closed");
    await until(() => server.conns.every((c) => c.ws.readyState === WebSocket.CLOSED));
  });
});

describe("createSttProvider", () => {
  it("builds an AssemblyAI provider from config", () => {
    const provider = createSttProvider({
      provider: "assemblyai",
      apiKey: "k",
      model: "universal-3-6-pro",
      language: "multi",
    });
    expect(provider.name).toBe("assemblyai");
  });
});
