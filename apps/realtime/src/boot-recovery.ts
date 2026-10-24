import { existsSync, statSync } from "node:fs";
import type { Repositories } from "@recap/db";
import { wavPathFor } from "./audio/audio-writer";
import { WAV_BLOCK_ALIGN, WAV_HEADER_BYTES, bytesToMs } from "./audio/wav";

/** Recorded audio length of a meeting from its WAV file (sizes derive from file length). */
export function recordedMsFromWav(audioDir: string, meetingId: string): number | undefined {
  const path = wavPathFor(audioDir, meetingId);
  if (!existsSync(path)) return undefined;
  const dataBytes = Math.max(0, statSync(path).size - WAV_HEADER_BYTES);
  return bytesToMs(Math.floor(dataBytes / WAV_BLOCK_ALIGN) * WAV_BLOCK_ALIGN);
}

/**
 * Ends every meeting left `live` by a hard crash. Run once at boot BEFORE the socket accepts
 * connections. Assumes exactly one realtime process per database (see CLAUDE.md): any `live`
 * row at this point is orphaned, none can belong to a running session. Safe to repeat.
 */
export function recoverInterruptedMeetings(
  repos: Repositories,
  audioDir: string,
  log: (message: string) => void = console.log,
): string[] {
  const ids = repos.meetings.recoverLive(new Date().toISOString(), (id) =>
    recordedMsFromWav(audioDir, id),
  );
  for (const id of ids) log(`[realtime] recovered meeting left live by a crash: ${id}`);
  return ids;
}
