import type { Channel } from "@recap/core";

/** A pause longer than this between two lines of one speaker starts a new turn. */
export const TURN_GAP_MS = 30_000;

/** What turn grouping needs to know about a spoken row. */
export interface TurnPoint {
  channel: Channel;
  startMs: number;
  endMs: number;
}

/**
 * Whether a spoken row opens a new turn (shows speaker icon + name). `previous` is the row right
 * above it in the loaded list, or null when that is not speech (list start, topic divider, page
 * edge): a row whose predecessor is unknown always gets its header.
 */
export function startsTurn(previous: TurnPoint | null, current: TurnPoint): boolean {
  if (previous === null) return true;
  if (previous.channel !== current.channel) return true;
  return current.startMs - previous.endMs > TURN_GAP_MS;
}
