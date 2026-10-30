import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createHarness, type Harness } from "./helpers";

let harness: Harness;
const sockets: WebSocket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  await harness.close();
});

interface Outcome {
  socket: WebSocket;
  closeCode: number | null;
}

/** Opens a socket; resolves once it either stays open briefly or is closed by the server. */
function open(port: number): Promise<Outcome> {
  return new Promise((resolve) => {
    const socket = new WebSocket(`ws://localhost:${port}/ws`);
    sockets.push(socket);
    const outcome: Outcome = { socket, closeCode: null };
    socket.once("close", (code) => {
      outcome.closeCode = code;
      resolve(outcome);
    });
    socket.once("open", () => setTimeout(() => resolve(outcome), 100));
  });
}

describe("connection cap", () => {
  it("accepts exactly the configured number and refuses the next with 1013", async () => {
    harness = await createHarness({}, { maxConnections: 2 });
    const first = await open(harness.port);
    const second = await open(harness.port);
    const third = await open(harness.port);
    expect([first.closeCode, second.closeCode]).toEqual([null, null]);
    expect(third.closeCode).toBe(1013);
  });

  it("frees a slot when a client leaves", async () => {
    harness = await createHarness({}, { maxConnections: 1 });
    const first = await open(harness.port);
    expect((await open(harness.port)).closeCode).toBe(1013);
    first.socket.close();
    await new Promise((resolve) => first.socket.once("close", resolve));
    expect((await open(harness.port)).closeCode).toBeNull();
  });
});
