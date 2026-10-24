"use client";

import { useEffect, useState } from "react";

const TICK_MS = 250;

/** Meeting timeline position in ms (`clockOrigin` = epoch ms of timeline 0), ticking while `running`. */
export function useElapsed(clockOrigin: number | null, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [running]);

  if (clockOrigin === null) return 0;
  return Math.max(0, now - clockOrigin);
}
