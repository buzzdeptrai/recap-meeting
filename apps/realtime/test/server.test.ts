import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { parseServerMessage, type ServerMessage } from "@recap/core";
import { createRealtimeServer } from "../src/app";

const server = createRealtimeServer();
let port = 0;

beforeAll(async () => {
  port = await server.listen(0);
});
afterAll(() => server.close());

function connect(path = "/ws"): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://localhost:${port}${path}`);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function nextMessage(socket: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    socket.once("message", (data) => {
      const parsed = parseServerMessage(data as Buffer);
      if (parsed.ok) resolve(parsed.message);
      else reject(new Error(parsed.error));
    });
  });
}

async function roundTrip(payload: string | Buffer): Promise<ServerMessage> {
  const socket = await connect();
  const reply = nextMessage(socket);
  socket.send(payload);
  const message = await reply;
  socket.close();
  return message;
}

describe("realtime server", () => {
  it("GET /health returns ok", async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("unknown routes return 404", async () => {
    const res = await fetch(`http://localhost:${port}/nope`);
    expect(res.status).toBe(404);
  });

  it("replies pong to ping", async () => {
    expect(await roundTrip(JSON.stringify({ type: "ping", t: 42 }))).toEqual({
      type: "pong",
      t: 42,
    });
  });

  it.each(["not json", JSON.stringify({ type: "start", meetingId: "" })])(
    "replies BAD_MESSAGE to invalid input %s",
    async (payload) => {
      expect(await roundTrip(payload)).toMatchObject({ type: "error", code: "BAD_MESSAGE" });
    },
  );

  it("rejects audio before start", async () => {
    expect(await roundTrip(Buffer.alloc(8))).toMatchObject({ type: "error", code: "BAD_MESSAGE" });
  });

  it("refuses upgrades on other paths", async () => {
    await expect(connect("/other")).rejects.toThrow();
  });
});
