import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { AssemblyAiProvider, buildListenUrl, type AssemblyAiConfig } from "../src";

describe("Deepgram URL for a mono session", () => {
  const config = { apiKey: "secret-key", model: "nova-3", language: "multi" as const };

  it("asks for one channel without multichannel", () => {
    const url = new URL(buildListenUrl({ ...config, channels: 1 }));
    expect(url.searchParams.get("channels")).toBe("1");
    expect(url.searchParams.get("multichannel")).toBe("false");
  });

  it("keeps the stereo multichannel default", () => {
    const url = new URL(buildListenUrl(config));
    expect(url.searchParams.get("channels")).toBe("2");
    expect(url.searchParams.get("multichannel")).toBe("true");
  });
});

describe("AssemblyAI mono session", () => {
  let wss: WebSocketServer | undefined;
  let provider: AssemblyAiProvider | undefined;
  const received: Uint8Array[][] = [];

  afterEach(async () => {
    await provider?.close();
    for (const client of wss?.clients ?? []) client.terminate();
    await new Promise((resolve) => wss?.close(resolve));
    received.length = 0;
  });

  it("opens a single socket and forwards the mono frame untouched", async () => {
    wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    await new Promise((resolve) => wss?.once("listening", resolve));
    wss.on("connection", (ws) => {
      const frames: Uint8Array[] = [];
      received.push(frames);
      ws.on("message", (data, isBinary) => {
        if (isBinary) frames.push(new Uint8Array(data as Buffer));
      });
      ws.send(JSON.stringify({ type: "Begin", id: "s" }));
    });
    const config: AssemblyAiConfig = {
      apiKey: "k",
      model: "universal-3-6-pro",
      language: "multi",
      channels: 1,
      baseUrl: `ws://127.0.0.1:${(wss.address() as AddressInfo).port}/v3/ws`,
      closeTimeoutMs: 200,
    };
    provider = new AssemblyAiProvider(config, { random: () => 0 });
    await provider.open();
    provider.sendAudio(new Uint8Array([1, 2, 3, 4]));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(received).toHaveLength(1);
    expect(received[0]?.map((f) => [...f])).toEqual([[1, 2, 3, 4]]);
  });
});
