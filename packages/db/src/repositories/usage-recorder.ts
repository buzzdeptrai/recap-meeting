import { computeCostUsd, type Pricing, type UsageEventInput, type UsageSink } from "@recap/core";
import type { UsageRepository } from "./usage";

/**
 * Fire-and-forget recorder: prices the event, writes it, and swallows every failure (only the
 * error message is logged, never event values) so metering can never break a hot path.
 */
export function createUsageRecorder(
  usage: Pick<UsageRepository, "record">,
  pricing: Pricing,
  logError: (message: string) => void = (message) => console.error(`[usage] ${message}`),
): UsageSink {
  return (event: UsageEventInput) => {
    try {
      usage.record({ ...event, costUsd: computeCostUsd(event, pricing) });
    } catch (error) {
      try {
        logError(`record failed: ${error instanceof Error ? error.message : "unknown error"}`);
      } catch {
        // logging itself must not throw either
      }
    }
  };
}
