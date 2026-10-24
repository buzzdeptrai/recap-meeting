import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FRAME_BYTES, parseServerMessage, type ServerMessage } from "@recap/core";
import { IN_MEMORY, createRepositories, openDatabase } from "@recap/db";
import { FakeSttProvider, type FakeSttOptions } from "@recap/stt";
import WebSocket from "ws";
import { createRealtimeServer, type RealtimeServer } from "../src/app";
import type { RealtimeDeps } from "../src/deps";
import { SessionRegistry } from "../src/session/registry";

const WAIT_TIMEOUT_MS = 2_000;

export interface Harness {
  server: RealtimeServer;
  deps: RealtimeDeps;
  port: number;
  audioDir: string;
  /** Providers created so far, in order (one per session). */
  providers: FakeSttProvider[];
  setFakeOptions(options: FakeSttOptions): void;
  close(): Promise<void>;
}

export async function createHarness(overrides: Partial<RealtimeDeps> = {}): Promise<Harness> {
  const db = openDatabase(IN_MEMORY);
  const audioDir = mkdtempSync(join(tmpdir(), "recap-audio-"));
  const providers: FakeSttProvider[] = [];
  let fakeOptions: FakeSttOptions = {};
  const deps: RealtimeDeps = {
    repos: createRepositories(db),
    audioDir,
    registry: new SessionRegistry(),
    createStt: () => {
      const provider = new FakeSttProvider(fakeOptions);
      providers.push(provider);
      return provider;
    },
    ...overrides,
  };
  const server = createRealtimeServer(deps);
  const port = await server.listen(0);
  return {
    server,
    deps,
    port,
    audioDir,
    providers,
    setFakeOptions: (options) => {
      fakeOptions = options;
    },
    close: async () => {
      await server.close();
      db.close();
    },
  };
}

/** WebSocket client that records every server message and lets tests await specific ones. */
export class TestClient {
  readonly messages: ServerMessage[] = [];
  private readonly waiters: Array<() => void> = [];

  private constructor(readonly socket: WebSocket) {
    socket.on("message", (data, isBinary) => {
      if (isBinary) return;
      const parsed = parseServerMessage(data as Buffer);
      if (!parsed.ok) throw new Error(`Server sent invalid message: ${parsed.error}`);
      this.messages.push(parsed.message);
      for (const wake of this.waiters.splice(0)) wake();
    });
  }

  static connect(port: number): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://localhost:${port}/ws`);
      socket.once("open", () => resolve(new TestClient(socket)));
      socket.once("error", reject);
    });
  }

  sendJson(message: unknown): void {
    this.socket.send(typeof message === "string" ? message : JSON.stringify(message));
  }

  sendFrames(count: number, byteLength = FRAME_BYTES): void {
    for (let i = 0; i < count; i++) this.socket.send(Buffer.alloc(byteLength, 1));
  }

  of<T extends ServerMessage["type"]>(type: T): Array<Extract<ServerMessage, { type: T }>> {
    return this.messages.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  }

  /** Resolves with the first message matching `predicate` (already received or future). */
  async waitFor(predicate: (m: ServerMessage) => boolean): Promise<ServerMessage> {
    const deadline = Date.now() + WAIT_TIMEOUT_MS;
    for (;;) {
      const found = this.messages.find(predicate);
      if (found) return found;
      if (Date.now() > deadline) throw new Error(`Timed out; got ${JSON.stringify(this.messages)}`);
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
        setTimeout(resolve, 50);
      });
    }
  }

  waitForType(type: ServerMessage["type"]): Promise<ServerMessage> {
    return this.waitFor((m) => m.type === type);
  }

  async close(): Promise<void> {
    if (this.socket.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolve) => {
      this.socket.once("close", () => resolve());
      this.socket.close();
    });
  }
}

export const startMessage = (meetingId: string, extra: Record<string, unknown> = {}) => ({
  type: "start",
  meetingId,
  sourceLang: "multi",
  targetLang: "vi",
  ...extra,
});
