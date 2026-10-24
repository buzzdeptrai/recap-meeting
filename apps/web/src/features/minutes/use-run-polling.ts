"use client";

import { useEffect, useRef } from "react";
import { POLL_INTERVAL_MS, shouldPoll } from "./run-progress";

/**
 * Calls `poll` every ~2 s while `active`, skipping ticks while the tab is hidden and polling at
 * once when it becomes visible again. Never runs two polls at the same time; stops on unmount.
 */
export function useRunPolling(active: boolean, poll: () => Promise<void>) {
  const pollRef = useRef(poll);
  useEffect(() => {
    pollRef.current = poll;
  });

  useEffect(() => {
    if (!active) return;
    let busy = false;
    let stopped = false;
    const tick = async () => {
      if (busy || stopped || !shouldPoll(active, !document.hidden)) return;
      busy = true;
      try {
        await pollRef.current();
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    const onVisible = () => void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);
}
