import { describe, expect, it } from "vitest";
import {
  createWakeLock,
  type WakeLockHost,
  type WakeLockSentinelLike,
  type WakeLockState,
} from "./wake-lock";

class FakeSentinel implements WakeLockSentinelLike {
  released = false;
  private listeners: Array<() => void> = [];
  async release() {
    this.released = true;
    this.listeners.forEach((l) => l());
  }
  addEventListener(_type: "release", listener: () => void) {
    this.listeners.push(listener);
  }
}

function makeHost(options: { supported?: boolean; reject?: boolean } = {}) {
  const sentinels: FakeSentinel[] = [];
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: "visible",
    addEventListener: (_t: string, l: () => void) => listeners.add(l),
    removeEventListener: (_t: string, l: () => void) => listeners.delete(l),
  };
  const nav =
    options.supported === false
      ? {}
      : {
          wakeLock: {
            request: async () => {
              if (options.reject) throw new Error("NotAllowedError");
              const s = new FakeSentinel();
              sentinels.push(s);
              return s;
            },
          },
        };
  const host = { nav, doc } as unknown as WakeLockHost;
  const setVisibility = async (state: string) => {
    doc.visibilityState = state;
    listeners.forEach((l) => l());
    await Promise.resolve();
    await Promise.resolve();
  };
  return { host, sentinels, listeners, setVisibility };
}

describe("createWakeLock", () => {
  it("reports unsupported without the API and does nothing", async () => {
    const { host, listeners } = makeHost({ supported: false });
    const lock = createWakeLock(() => undefined, host);
    await lock.start();
    expect(lock.state()).toBe("unsupported");
    expect(listeners.size).toBe(0);
  });

  it("acquires on start and releases on stop", async () => {
    const { host, sentinels, listeners } = makeHost();
    const states: WakeLockState[] = [];
    const lock = createWakeLock((s) => states.push(s), host);
    await lock.start();
    expect(lock.state()).toBe("active");
    expect(listeners.size).toBe(1);
    await lock.stop();
    expect(sentinels[0]?.released).toBe(true);
    expect(listeners.size).toBe(0);
    expect(lock.state()).toBe("idle");
    expect(states).toEqual(["active", "idle"]);
  });

  it("re-acquires after the page was hidden and shown again", async () => {
    const { host, sentinels, setVisibility } = makeHost();
    const lock = createWakeLock(() => undefined, host);
    await lock.start();
    await sentinels[0]?.release(); // the browser releases it when the page is hidden
    expect(lock.state()).toBe("idle");
    await setVisibility("hidden");
    expect(sentinels).toHaveLength(1);
    await setVisibility("visible");
    expect(sentinels).toHaveLength(2);
    expect(lock.state()).toBe("active");
  });

  it("does not request a second lock while one is held", async () => {
    const { host, sentinels, setVisibility } = makeHost();
    const lock = createWakeLock(() => undefined, host);
    await lock.start();
    await setVisibility("visible");
    expect(sentinels).toHaveLength(1);
  });

  it("reports denied when the request is rejected", async () => {
    const { host } = makeHost({ reject: true });
    const lock = createWakeLock(() => undefined, host);
    await lock.start();
    expect(lock.state()).toBe("denied");
  });
});
