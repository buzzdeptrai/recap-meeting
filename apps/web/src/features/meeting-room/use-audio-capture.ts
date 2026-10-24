"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CaptureError,
  startCapture,
  type CaptureEvents,
  type CaptureSession,
  type SourceStatus,
} from "@/audio/capture";
import { createLevelStore, type LevelStore } from "@/audio/level-store";
import { useStableCallback } from "./use-stable-callback";

export type CapturePhase = "idle" | "requesting" | "running" | "error";

export interface AudioCaptureApi {
  phase: CapturePhase;
  sources: SourceStatus;
  /** Live meter values; subscribe with useLevels(levels). */
  levels: LevelStore;
  error: string | null;
  start: () => Promise<boolean>;
  stop: () => void;
  reshareTab: () => Promise<void>;
}

const IDLE_SOURCES: SourceStatus = { tab: "missing", mic: "ok" };

type CaptureOutcome = { session: CaptureSession } | { error: string } | null;

/** Runs `startCapture`; resolves null (and releases the stream) when `isCurrent` turned false meanwhile. */
async function attemptCapture(
  events: CaptureEvents,
  isCurrent: () => boolean,
): Promise<CaptureOutcome> {
  try {
    const session = await startCapture(events);
    if (isCurrent()) return { session };
    session.stop();
    return null;
  } catch (cause) {
    if (!isCurrent()) return null;
    return { error: cause instanceof CaptureError ? cause.message : "Không bật được âm thanh." };
  }
}

/** Browser audio capture lifecycle. `start` must be called from a click handler. */
export function useAudioCapture(onFrame: (frame: ArrayBuffer) => void): AudioCaptureApi {
  const [phase, setPhase] = useState<CapturePhase>("idle");
  const [sources, setSources] = useState<SourceStatus>(IDLE_SOURCES);
  const [error, setError] = useState<string | null>(null);
  const levels = useMemo(() => createLevelStore(), []);
  const session = useRef<CaptureSession | null>(null);
  /** Bumped by stop/unmount so a picker that resolves later is discarded instead of started. */
  const generation = useRef(0);
  const starting = useRef(false);
  const emitFrame = useStableCallback(onFrame);

  /** Invalidates any pending picker and stops the running session (also on unmount). */
  const release = useCallback(() => {
    generation.current += 1;
    session.current?.stop();
    session.current = null;
  }, []);

  const stop = useCallback(() => {
    release();
    levels.reset();
    setPhase("idle");
  }, [release, levels]);

  const start = useCallback(async () => {
    if (starting.current || session.current) return false;
    starting.current = true;
    const mine = ++generation.current;
    setPhase("requesting");
    setError(null);
    const events = { onFrame: emitFrame, onRms: levels.pushRms, onSourceChange: setSources };
    const outcome = await attemptCapture(events, () => generation.current === mine);
    starting.current = false;
    if (!outcome) return false;
    if ("error" in outcome) {
      setError(outcome.error);
      setPhase("error");
      return false;
    }
    session.current = outcome.session;
    setPhase("running");
    return true;
  }, [levels, emitFrame]);

  const reshareTab = useCallback(async () => {
    try {
      await session.current?.reshareTab();
    } catch (cause) {
      setError(cause instanceof CaptureError ? cause.message : null);
    }
  }, []);

  useEffect(() => release, [release]);

  return { phase, sources, levels, error, start, stop, reshareTab };
}
