/**
 * Screen Wake Lock while recording. The lock is released by the browser whenever the page is
 * hidden, so it is requested again when the page becomes visible. Unsupported browsers (older
 * iOS) just report "unsupported" and the UI keeps the "do not lock the phone" warning.
 */

export type WakeLockState = "unsupported" | "idle" | "active" | "denied";

export interface WakeLockSentinelLike {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

export interface WakeLockHost {
  nav: { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };
  doc: Pick<Document, "addEventListener" | "removeEventListener"> & {
    visibilityState: string;
  };
}

export interface WakeLockHandle {
  /** Begins holding the lock (and re-acquiring it after the page was hidden). */
  start: () => Promise<void>;
  stop: () => Promise<void>;
  state: () => WakeLockState;
}

function browserHost(): WakeLockHost {
  return { nav: navigator as unknown as WakeLockHost["nav"], doc: document };
}

export function createWakeLock(
  onChange: (state: WakeLockState) => void,
  host: WakeLockHost = browserHost(),
): WakeLockHandle {
  let current: WakeLockState = host.nav.wakeLock ? "idle" : "unsupported";
  let wanted = false;
  let sentinel: WakeLockSentinelLike | null = null;

  const set = (next: WakeLockState) => {
    if (next === current) return;
    current = next;
    onChange(next);
  };

  const acquire = async () => {
    const api = host.nav.wakeLock;
    if (!api || !wanted || host.doc.visibilityState !== "visible") return;
    if (sentinel && !sentinel.released) return;
    try {
      const next = await api.request("screen");
      if (!wanted) return void next.release().catch(() => undefined);
      sentinel = next;
      next.addEventListener("release", () => {
        if (sentinel === next) set(wanted ? "idle" : current);
      });
      set("active");
    } catch {
      set("denied");
    }
  };

  const onVisibility = () => void acquire();

  return {
    async start() {
      if (!host.nav.wakeLock) return onChange("unsupported");
      if (wanted) return;
      wanted = true;
      host.doc.addEventListener("visibilitychange", onVisibility);
      await acquire();
    },
    async stop() {
      wanted = false;
      host.doc.removeEventListener("visibilitychange", onVisibility);
      const held = sentinel;
      sentinel = null;
      await held?.release().catch(() => undefined);
      set(host.nav.wakeLock ? "idle" : "unsupported");
    },
    state: () => current,
  };
}
