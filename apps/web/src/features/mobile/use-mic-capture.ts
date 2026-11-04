"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CaptureError } from "@/audio/capture";
import { createLevelStore, type LevelStore } from "@/audio/level-store";
import {
  startMicCapture,
  type MicCaptureEvents,
  type MicCaptureSession,
} from "@/audio/mic-capture";
import { useStableCallback } from "../meeting-room/use-stable-callback";
import { RESUME_FAILED } from "./mobile-copy";

export type MicPhase = "idle" | "requesting" | "running" | "error";

export interface MicCaptureApi {
  phase: MicPhase;
  levels: LevelStore;
  /** Capture stopped delivering sound without the user stopping it. */
  interrupted: boolean;
  error: string | null;
  start: () => Promise<boolean>;
  stop: () => void;
  /** "Tiếp tục": resume the context and re-open the mic; false when that did not work. */
  resume: () => Promise<boolean>;
}

type CaptureOutcome = { session: MicCaptureSession } | { error: string } | null;

const errorText = (cause: unknown) =>
  cause instanceof CaptureError ? cause.message : "Không bật được micro.";

/** Runs `startMicCapture`; resolves null (and releases the mic) when `isCurrent` turned false meanwhile. */
async function attemptCapture(
  events: MicCaptureEvents,
  isCurrent: () => boolean,
): Promise<CaptureOutcome> {
  try {
    const session = await startMicCapture(events);
    if (isCurrent()) return { session };
    session.stop();
    return null;
  } catch (cause) {
    return isCurrent() ? { error: errorText(cause) } : null;
  }
}

function captureEvents(
  onFrame: (frame: ArrayBuffer) => void,
  levels: LevelStore,
  onInterrupted: (interrupted: boolean) => void,
): MicCaptureEvents {
  return {
    onFrame,
    onRms: (level) => levels.pushRms(level, 0),
    onMicChange: () => undefined,
    onInterrupted,
  };
}

/** One call at a time: a second call (e.g. a dev double effect) joins the one in flight. */
function useSingleFlight(run: () => Promise<boolean>): () => Promise<boolean> {
  const pending = useRef<Promise<boolean> | null>(null);
  return useCallback(() => {
    pending.current ??= run().finally(() => {
      pending.current = null;
    });
    return pending.current;
  }, [run]);
}

/** Mic-only capture lifecycle for the phone page. `start` must run from a tap. */
export function useMicCapture(onFrame: (frame: ArrayBuffer) => void): MicCaptureApi {
  const [phase, setPhase] = useState<MicPhase>("idle");
  const [interrupted, setInterrupted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const levels = useMemo(() => createLevelStore(), []);
  const session = useRef<MicCaptureSession | null>(null);
  /** Bumped by stop/unmount so a start that resolves later is discarded. */
  const generation = useRef(0);
  const emitFrame = useStableCallback(onFrame);

  const release = useCallback(() => {
    generation.current += 1;
    session.current?.stop();
    session.current = null;
  }, []);

  const stop = useCallback(() => {
    release();
    levels.reset();
    setInterrupted(false);
    setPhase("idle");
  }, [release, levels]);

  const run = useCallback(async () => {
    if (session.current) return true;
    const mine = ++generation.current;
    setPhase("requesting");
    setError(null);
    const events = captureEvents(emitFrame, levels, setInterrupted);
    const outcome = await attemptCapture(events, () => generation.current === mine);
    if (!outcome) return false;
    if ("error" in outcome) {
      setError(outcome.error);
      setPhase("error");
      return false;
    }
    session.current = outcome.session;
    setPhase("running");
    return true;
  }, [emitFrame, levels]);

  /** Restarts the session; clears the interruption on success, explains otherwise. */
  const resume = useCallback(async () => {
    const ok = (await session.current?.restart()) ?? false;
    if (ok) setInterrupted(false);
    setError(ok ? null : RESUME_FAILED);
    return ok;
  }, []);

  useReleaseOnUnmount(release);

  return { phase, levels, interrupted, error, start: useSingleFlight(run), stop, resume };
}

/**
 * Releases on a real unmount only. React's dev StrictMode unmounts and remounts once right away;
 * releasing there would cancel the start that the first effect run began.
 */
function useReleaseOnUnmount(release: () => void) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) release();
      });
    };
  }, [release]);
}
