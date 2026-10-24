import { MINUTES_LANGS, type MinutesLang } from "@recap/core";
import type { Meeting, Repositories } from "@recap/db";
import {
  extractSuggestions,
  NO_SUGGESTIONS,
  type MinutesSuggestions,
} from "@/features/meeting-room/minutes-suggestions";
import { getRepositories } from "./db";

/** Target language first, then the other languages that may hold minutes. */
function langOrder(meeting: Meeting): MinutesLang[] {
  const preferred = MINUTES_LANGS.find((lang) => lang === meeting.targetLang);
  return preferred
    ? [preferred, ...MINUTES_LANGS.filter((l) => l !== preferred)]
    : [...MINUTES_LANGS];
}

/**
 * Read-only suggestions for the room's side panel, from the stored minutes of an ended meeting.
 * Missing, unreadable or corrupt minutes give no suggestions (the room then looks as before).
 */
export function loadMinutesSuggestions(
  meeting: Meeting,
  repos: Repositories = getRepositories(),
): MinutesSuggestions {
  if (meeting.status !== "ended") return NO_SUGGESTIONS;
  for (const lang of langOrder(meeting)) {
    try {
      const stored = repos.minutes.get(meeting.id, lang);
      if (stored) return extractSuggestions(stored.content);
    } catch {
      // Corrupt row: try the next language, never break the room.
    }
  }
  return NO_SUGGESTIONS;
}
