import { createEchoDetector } from "./echo-detector";
import { createSilenceDetector } from "./silence";
import type { SourceFlags } from "./source-monitor";

export interface LevelMonitor {
  /** Feeds one frame's RMS; returns the flags that depend on levels. */
  feed: (mic: number, tab: number) => Pick<SourceFlags, "micSilent" | "tabSilent" | "micEcho">;
  resetMic: () => void;
  resetTab: () => void;
}

/** Silence and echo detection side by side; echo never influences the silence detector. */
export function createLevelMonitor(now: () => number = () => performance.now()): LevelMonitor {
  const silence = createSilenceDetector();
  const echo = createEchoDetector();
  return {
    feed(mic, tab) {
      const flags = silence.feed(mic, tab, now());
      return { micSilent: flags.mic, tabSilent: flags.tab, micEcho: echo.feed(mic, tab) };
    },
    resetMic() {
      silence.reset("mic", now());
      echo.reset();
    },
    resetTab() {
      silence.reset("tab", now());
      echo.reset();
    },
  };
}
