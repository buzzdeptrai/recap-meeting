import type { SttChannelActivity } from "@recap/stt";
import { log, safelySync } from "./safe";

/** The only part of a segmenter this handler needs. */
interface Flushable {
  flush(): void;
}

/**
 * Reacts to a per-channel STT state change. `reconnecting`: the old socket is gone, so its
 * unfinished turn never gets a final; emit the buffered tail now, before the new socket's first
 * words arrive. Safe to repeat (flush on an empty segmenter emits nothing).
 */
export function handleChannelActivity(
  meetingId: string,
  { channel, state }: SttChannelActivity,
  segmenters: readonly Flushable[],
): void {
  log(`${meetingId} STT ch${channel} ${state}`);
  if (state !== "reconnecting") return;
  const segmenter = segmenters[channel];
  if (segmenter) safelySync("flush segmenter on reconnect", () => segmenter.flush());
}
