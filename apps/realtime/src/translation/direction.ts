import type { SourceLang, TargetLang } from "@recap/core";
import type { SessionLanguages } from "../session/types";
import { detectLanguage } from "./detect-language";

export interface Direction {
  sourceLang: SourceLang;
  targetLang: TargetLang;
}

/** "en-US" → "en"; null / blank stay null. */
function baseLanguage(lang: string | null): string | null {
  const base = lang?.trim().toLowerCase().split(/[-_]/)[0];
  return base ? base : null;
}

function isTargetLang(lang: string | null): lang is TargetLang {
  return lang === "vi" || lang === "en";
}

/**
 * Segment language: a confident local text guess beats the provider label (labels go stale at a
 * language switch); an unsure guess keeps the provider's vi/en label; otherwise null (unknown).
 */
function segmentLanguage(reported: string | null, text: string | undefined): TargetLang | null {
  const guess = text ? detectLanguage(text) : "unknown";
  if (guess !== "unknown") return guess;
  return isTargetLang(reported) ? reported : null;
}

/**
 * Decides what to translate a segment from/to. Returns null when the segment is already in the
 * meeting's target language (no event, no cost). Unknown language → the session's fixed source
 * language if it has one, otherwise the auto-detect prompt.
 */
export function resolveDirection(
  segmentLang: string | null,
  { sourceLang, targetLang }: SessionLanguages,
  text?: string,
): Direction | null {
  const detected = segmentLanguage(baseLanguage(segmentLang), text);
  if (detected === targetLang) return null;
  if (detected) return { sourceLang: detected, targetLang };
  if (isTargetLang(sourceLang) && sourceLang !== targetLang) return { sourceLang, targetLang };
  return { sourceLang: "auto", targetLang };
}
