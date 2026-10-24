"use client";

import { useEffect, useMemo, useState } from "react";
import { createLevelStore, type LevelStore } from "@/audio/level-store";
import { openMicStream, stopStream } from "@/audio/mic-stream";
import { createSilenceTimer, MIC_TEST_QUIET_MS } from "@/audio/mic-test";

export type MicTestState = "idle" | "listening" | "unavailable";

export interface MicTest {
  levels: LevelStore;
  state: MicTestState;
  /** True once the mic stayed quiet for MIC_TEST_QUIET_MS. */
  quiet: boolean;
}

const POLL_MS = 100;

/**
 * Opens a temporary mic stream for `deviceId` while `enabled` and feeds a level store from an
 * AnalyserNode. The stream and AudioContext are released on disable, device change and unmount.
 */
export function useMicTest(
  deviceId: string | null,
  enabled: boolean,
  onOpened: () => void,
): MicTest {
  const levels = useMemo(() => createLevelStore(), []);
  const [state, setState] = useState<MicTestState>("idle");
  const [quiet, setQuiet] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const teardown = () => {
      if (timer) clearInterval(timer);
      stopStream(stream);
      void context?.close().catch(() => undefined);
      levels.reset();
    };

    const run = async () => {
      const opened = await openMicStream(deviceId, true);
      if (cancelled) return stopStream(opened);
      if (!opened) return setState("unavailable");
      stream = opened;
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(opened).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      const silence = createSilenceTimer(MIC_TEST_QUIET_MS);
      setState("listening");
      onOpened();
      timer = setInterval(() => {
        analyser.getFloatTimeDomainData(buffer);
        const rms = Math.sqrt(buffer.reduce((sum, v) => sum + v * v, 0) / buffer.length);
        levels.pushRms(rms, 0);
        setQuiet(silence.feed(rms, performance.now()));
      }, POLL_MS);
    };
    void run();

    return () => {
      cancelled = true;
      teardown();
      setState("idle");
      setQuiet(false);
    };
    // onOpened is intentionally excluded: it must not restart the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, enabled, levels]);

  return { levels, state, quiet };
}
