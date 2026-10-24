import type { ServerMessage } from "@recap/core";

export interface RunSummary {
  segments: number;
  translations: number;
  translateErrors: number;
  otherErrors: string[];
  avgTranslationLatencyMs: number | null;
  providers: string[];
  lastStatus: { stt: string; provider: string | null; degraded: boolean } | null;
}

/** Aggregates the server events of one streaming run (pure; unit-tested). */
export function summarize(messages: readonly ServerMessage[]): RunSummary {
  let segments = 0;
  let translateErrors = 0;
  const otherErrors: string[] = [];
  const latencies: number[] = [];
  const providers = new Set<string>();
  let lastStatus: RunSummary["lastStatus"] = null;
  for (const message of messages) {
    if (message.type === "segment") segments += 1;
    if (message.type === "translation") {
      latencies.push(message.latencyMs);
      providers.add(message.provider);
    }
    if (message.type === "error") {
      if (message.code === "TRANSLATE_FAILED") translateErrors += 1;
      else otherErrors.push(`${message.code}: ${message.message}`);
    }
    if (message.type === "status") {
      lastStatus = {
        stt: message.stt,
        provider: message.translate.provider,
        degraded: message.translate.degraded,
      };
    }
  }
  const sum = latencies.reduce((total, value) => total + value, 0);
  return {
    segments,
    translations: latencies.length,
    translateErrors,
    otherErrors,
    avgTranslationLatencyMs: latencies.length ? Math.round(sum / latencies.length) : null,
    providers: [...providers],
    lastStatus,
  };
}
