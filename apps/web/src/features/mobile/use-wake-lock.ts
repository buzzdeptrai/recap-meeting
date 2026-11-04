"use client";

import { useEffect, useState } from "react";
import { createWakeLock, type WakeLockState } from "@/audio/wake-lock";

/** Holds the screen awake while `active` (the lock is requested again after the page was hidden). */
export function useWakeLock(active: boolean): WakeLockState {
  const [state, setState] = useState<WakeLockState>("idle");
  useEffect(() => {
    if (!active) return;
    const lock = createWakeLock(setState);
    void lock.start();
    return () => void lock.stop();
  }, [active]);
  return state;
}
