"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Distance from the bottom (px) still counted as "following the latest line". */
const FOLLOW_THRESHOLD_PX = 64;

/** Auto-follow a growing list; stops when the user scrolls up, resumes on demand. */
export function useFollowScroll(contentVersion: unknown) {
  const scroller = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD_PX);
  }, []);

  const jumpToLatest = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setFollowing(true);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (following && el) el.scrollTop = el.scrollHeight;
  }, [contentVersion, following]);

  return { scroller, following, onScroll, jumpToLatest };
}
