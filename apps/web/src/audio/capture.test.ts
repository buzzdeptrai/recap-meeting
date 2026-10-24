import { afterEach, describe, expect, it, vi } from "vitest";
import { createSession } from "./capture";

function fakeGraph(close: () => Promise<void>) {
  return {
    merger: {},
    node: {},
    onLevels: () => undefined,
    context: { close, createMediaStreamSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }) },
  } as unknown as Parameters<typeof createSession>[0];
}

const events = { onRms: vi.fn(), onSourceChange: vi.fn() } as unknown as Parameters<
  typeof createSession
>[1];

function emptyStream() {
  return { getAudioTracks: () => [], getTracks: () => [] } as unknown as MediaStream;
}

describe("createSession.stop", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is idempotent and never leaves a rejected close() unhandled", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    let closed = false;
    const close = vi.fn(() => {
      if (closed) return Promise.reject(new Error("Cannot close a closed AudioContext"));
      closed = true;
      return Promise.resolve();
    });
    const session = createSession(fakeGraph(close), events, emptyStream(), null);
    session.stop();
    session.stop();
    expect(close).toHaveBeenCalledTimes(1);
    close.mockImplementation(() => Promise.reject(new Error("boom")));
    const other = createSession(fakeGraph(close), events, emptyStream(), null);
    other.stop();
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
