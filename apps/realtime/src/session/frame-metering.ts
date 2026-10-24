import type { SttProvider, SttStatus } from "@recap/stt";
import type { SttRetry } from "./stt-retry";
import type { SttUsageMeter } from "./stt-usage-meter";

/**
 * Meters one accepted frame. Providers that skip silent channels report what they really sent
 * (`stt.usage`); for the others every frame counts on both channels while the connection is not
 * closed. While a manual retry is connecting, the retry counts frames itself.
 */
export function meterAcceptedFrame(
  stt: SttProvider,
  retry: SttRetry,
  meter: SttUsageMeter | null,
  status: SttStatus,
): void {
  const sent = stt.usage?.takeSentChannelFrames();
  if (retry.isRunning) return retry.countFrame();
  if (sent !== undefined) return meter?.addChannelFrames(sent);
  if (status !== "closed") meter?.addFrame();
}
