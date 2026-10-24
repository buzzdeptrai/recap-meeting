import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { FRAME_BYTES } from "@recap/core";
import { createRealtimeServer } from "../src/app";
import {
  MAX_AUDIO_FRAMES_PER_WINDOW,
  MAX_CONTROL_PER_WINDOW,
  MAX_PAYLOAD_BYTES,
} from "../src/limits";
import { isOriginAllowed, parseAllowedOrigins } from "../src/origin";

const server = createRealtimeServer();
let port = 0;
beforeAll(async () => {
  port = await server.listen(0);
});
afterAll(() => server.close());

const CLOSE_TOO_BIG = 1009;
const CLOSE_POLICY = 1008;

function open(origin?: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://localhost:${port}/ws`, origin ? { origin } : {});
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
    socket.once("unexpected-response", (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
  });
}

function closeCode(socket: WebSocket): Promise<number> {
  return new Promise((resolve) => socket.once("close", (code) => resolve(code)));
}

describe("isOriginAllowed", () => {
  it("allows missing Origin and loopback hosts on any port by default", () => {
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed("http://localhost:3000")).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:3000")).toBe(true);
    expect(isOriginAllowed("http://[::1]:3000")).toBe(true);
  });

  it("rejects foreign, malformed and non-http origins", () => {
    expect(isOriginAllowed("https://evil.example")).toBe(false);
    expect(isOriginAllowed("http://localhost.evil.example")).toBe(false);
    expect(isOriginAllowed("null")).toBe(false);
    expect(isOriginAllowed("file://localhost")).toBe(false);
  });

  it("honours configured origins, hostnames and wildcard", () => {
    expect(isOriginAllowed("http://192.168.1.5:3000", ["http://192.168.1.5:3000"])).toBe(true);
    expect(isOriginAllowed("http://192.168.1.6:3000", ["http://192.168.1.5:3000"])).toBe(false);
    expect(isOriginAllowed("https://x.example", ["*"])).toBe(true);
    expect(parseAllowedOrigins(" a , b ,")).toEqual(["a", "b"]);
    expect(parseAllowedOrigins("")).toContain("localhost");
  });
});

describe("websocket hardening", () => {
  it("accepts localhost and absent origins, refuses foreign origins with 403", async () => {
    (await open("http://localhost:3000")).close();
    (await open()).close();
    await expect(open("https://evil.example")).rejects.toThrow("HTTP 403");
  });

  it("closes the socket when a message exceeds the payload limit", async () => {
    const socket = await open();
    const closed = closeCode(socket);
    socket.send(Buffer.alloc(MAX_PAYLOAD_BYTES + 1));
    expect(await closed).toBe(CLOSE_TOO_BIG);
  });

  it("closes the socket when control messages flood", async () => {
    const socket = await open();
    const closed = closeCode(socket);
    for (let i = 0; i <= MAX_CONTROL_PER_WINDOW; i++)
      socket.send(JSON.stringify({ type: "ping", t: i }));
    expect(await closed).toBe(CLOSE_POLICY);
  });

  it("closes the socket when audio frames flood", async () => {
    const socket = await open();
    const closed = closeCode(socket);
    for (let i = 0; i <= MAX_AUDIO_FRAMES_PER_WINDOW; i++) socket.send(Buffer.alloc(FRAME_BYTES));
    expect(await closed).toBe(CLOSE_POLICY);
  });
});
