import { CHANNELS, SAMPLE_RATE } from "@recap/core";
import {
  DEEPGRAM_DEFAULTS,
  DEEPGRAM_LISTEN_URL,
  KEYTERM_URL_CHAR_BUDGET,
  MAX_KEYTERMS,
  type DeepgramConfig,
} from "./config";

/** Trims, dedupes (case-insensitive) and caps keyterms by count and encoded URL size. */
export function capKeyterms(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  let budget = KEYTERM_URL_CHAR_BUDGET;
  for (const raw of terms) {
    const term = raw.trim();
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    if (kept.length >= MAX_KEYTERMS) break;
    const cost = `&keyterm=${encodeURIComponent(term)}`.length;
    if (cost > budget) break;
    budget -= cost;
    seen.add(key);
    kept.push(term);
  }
  return kept;
}

/** Builds the streaming `listen` URL (stereo linear16, one transcript per channel). */
export function buildListenUrl(config: DeepgramConfig): string {
  const params = new URLSearchParams({
    model: config.model,
    encoding: "linear16",
    sample_rate: String(SAMPLE_RATE),
    channels: String(CHANNELS),
    multichannel: "true",
    interim_results: "true",
    punctuate: "true",
    smart_format: "true",
    endpointing: String(config.endpointingMs ?? DEEPGRAM_DEFAULTS.endpointingMs),
    utterance_end_ms: String(config.utteranceEndMs ?? DEEPGRAM_DEFAULTS.utteranceEndMs),
  });
  if (config.language === "detect") params.set("detect_language", "true");
  else params.set("language", config.language);
  const keyterms = capKeyterms(config.keyterms ?? [])
    .map((term) => `&keyterm=${encodeURIComponent(term)}`)
    .join("");
  return `${config.baseUrl ?? DEEPGRAM_LISTEN_URL}?${params.toString()}${keyterms}`;
}
