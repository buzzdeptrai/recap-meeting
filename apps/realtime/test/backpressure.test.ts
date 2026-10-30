import type { ServerMessage } from "@recap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { sendWithBackpressure } from "../src/backpressure";
import { CLOSE_SLOW_CONSUMER, HARD_BUFFER_BYTES, SOFT_BUFFER_BYTES } from "../src/limits";

const interim: ServerMessage = { type: "interim", channel: 0, text: "hi", startMs: 0, endMs: 1 };
const segment: ServerMessage = {
  type: "segment",
  segment: { id: "s1", seq: 0, channel: 0, lang: "en", startMs: 0, endMs: 1, text: "hi" },
};
const translation: ServerMessage = {
  type: "translation",
  segmentId: "s1",
  seq: 0,
  lang: "vi",
  text: "chao",
  provider: "p",
  latencyMs: 1,
};

function fakeSocket(bufferedAmount: number, readyState = 1) {
  const socket = {
    OPEN: 1,
    readyState,
    bufferedAmount,
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
  };
  return { socket, ws: socket as unknown as WebSocket };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("sendWithBackpressure", () => {
  it("sends everything while the buffer is small", () => {
    const { socket, ws } = fakeSocket(0);
    for (const message of [interim, segment, translation]) {
      expect(sendWithBackpressure(ws, message)).toBe(true);
    }
    expect(socket.send).toHaveBeenCalledTimes(3);
  });

  it("drops interim messages above the soft limit but still sends finals", () => {
    const { socket, ws } = fakeSocket(SOFT_BUFFER_BYTES + 1);
    expect(sendWithBackpressure(ws, interim)).toBe(false);
    expect(sendWithBackpressure(ws, segment)).toBe(true);
    expect(sendWithBackpressure(ws, translation)).toBe(true);
    expect(socket.send).toHaveBeenCalledTimes(2);
    expect(socket.close).not.toHaveBeenCalled();
  });

  it("keeps sending finals right at the hard limit", () => {
    const { socket, ws } = fakeSocket(HARD_BUFFER_BYTES);
    expect(sendWithBackpressure(ws, segment)).toBe(true);
    expect(socket.close).not.toHaveBeenCalled();
  });

  it("closes the socket above the hard limit, then force-terminates a stalled peer", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { socket, ws } = fakeSocket(HARD_BUFFER_BYTES + 1);
    expect(sendWithBackpressure(ws, segment)).toBe(false);
    expect(socket.send).not.toHaveBeenCalled();
    expect(socket.close).toHaveBeenCalledWith(CLOSE_SLOW_CONSUMER, "Client too slow");
    vi.advanceTimersByTime(10_000);
    expect(socket.terminate).toHaveBeenCalled();
  });

  it("does nothing for a socket that is not open", () => {
    const { socket, ws } = fakeSocket(0, 3);
    expect(sendWithBackpressure(ws, segment)).toBe(false);
    expect(socket.send).not.toHaveBeenCalled();
  });
});
