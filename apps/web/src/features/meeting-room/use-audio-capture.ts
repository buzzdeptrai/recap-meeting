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
import { loadMicChoice, saveMicChoice } from "@/audio/mic-storage";
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
  /** Hot-swap the mic of the running session and remember the choice; false if it could not open. */
  switchMic: (deviceId: string) => Promise<boolean>;
}

const IDLE_SOURCES: SourceStatus = { tab: "missing", mic: "ok" };

type CaptureOutcome = { session: CaptureSession } | { error: string } | null;

/** Runs `startCapture`; resolves null (and releases the stream) when `isCurrent` turned false meanwhile. */
async function attemptCapture(
  events: CaptureEvents,
  micDeviceId: string | null,
  isCurrent: () => boolean,
): Promise<CaptureOutcome> {
  try {
    const session = await startCapture(events, micDeviceId);
    if (isCurrent()) return { session };
    session.stop();
    return null;
  } catch (cause) {
    if (!isCurrent()) return null;
    return { error: cause instanceof CaptureError ? cause.message : "Không bật được âm thanh." };
  }
}

/** Hot-swaps the mic of a running session and remembers the choice on success. */
async function switchAndRemember(current: CaptureSession | null, deviceId: string) {
  const switched = (await current?.switchMic(deviceId)) ?? false;
  if (switched) saveMicChoice(deviceId);
  return switched;
}

/** Re-asks for the tab; returns the user-facing error (or null). */
async function reshareOrError(current: CaptureSession | null): Promise<string | null> {
  try {
    await current?.reshareTab();
    return null;
  } catch (cause) {
    return cause instanceof CaptureError ? cause.message : null;
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
    const outcome = await attemptCapture(
      events,
      loadMicChoice(),
      () => generation.current === mine,
    );
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
    const message = await reshareOrError(session.current);
    if (message) setError(message);
  }, []);

  const switchMic = useCallback((id: string) => switchAndRemember(session.current, id), []);

  useEffect(() => release, [release]);

  return { phase, sources, levels, error, start, stop, reshareTab, switchMic };
}
