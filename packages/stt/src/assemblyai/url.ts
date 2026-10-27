import { SAMPLE_RATE } from "@recap/core";
import {
  defaultTurnSilence,
  ASSEMBLYAI_DEFAULTS,
  ASSEMBLYAI_STREAM_URL,
  KEYTERM_URL_CHAR_BUDGET,
  MAX_KEYTERMS,
  MAX_KEYTERM_CHARS,
  type AssemblyAiConfig,
} from "./config";

/** Trims, dedupes (case-insensitive), drops over-long terms and caps by count and URL size. */
export function capKeyterms(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  let budget = KEYTERM_URL_CHAR_BUDGET;
  for (const raw of terms) {
    const term = raw.trim();
    const key = term.toLowerCase();
    if (!term || term.length > MAX_KEYTERM_CHARS || seen.has(key)) continue;
    if (kept.length >= MAX_KEYTERMS) break;
    const cost = encodeURIComponent(JSON.stringify(term)).length;
    if (cost > budget) break;
    budget -= cost;
    seen.add(key);
    kept.push(term);
  }
  return kept;
}

/**
 * Language decision: AssemblyAI (universal-3-6-pro) code-switches natively across 32 languages
 * including Vietnamese, so `multi`/`detect` send no language at all. A fixed `vi`/`en` is passed as
 * the documented single-element `language_codes` steering list. `language_detection` is always on:
 * it only makes each Turn report `language_code`; it does not change the transcription.
 * List parameters are sent as JSON arrays (the docs show JSON for `keyterms_prompt`; the
 * `language_codes` query encoding is assumed to match).
 */
export function buildStreamUrl(config: AssemblyAiConfig): string {
  const silence = defaultTurnSilence(config.language);
  const params = new URLSearchParams({
    speech_model: config.model,
    sample_rate: String(SAMPLE_RATE),
    encoding: "pcm_s16le",
    language_detection: "true",
    min_turn_silence: String(config.minTurnSilenceMs ?? silence.minMs),
    max_turn_silence: String(config.maxTurnSilenceMs ?? silence.maxMs),
  });
  // Server Heartbeat every 5 s (documented query param); feeds the stall watchdog.
  if ((config.stallTimeoutMs ?? ASSEMBLYAI_DEFAULTS.stallTimeoutMs) > 0) {
    params.set("session_heartbeat", "true");
  }
  if (config.language === "vi" || config.language === "en") {
    params.set("language_codes", JSON.stringify([config.language]));
  }
  const keyterms = capKeyterms(config.keyterms ?? []);
  if (keyterms.length > 0) params.set("keyterms_prompt", JSON.stringify(keyterms));
  return `${config.baseUrl ?? ASSEMBLYAI_STREAM_URL}?${params.toString()}`;
}
