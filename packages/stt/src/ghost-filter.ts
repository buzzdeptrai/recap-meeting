import type { Channel } from "@recap/core";

/** Longest CJK-only line (letters, punctuation ignored) that can be a hallucination. */
export const GHOST_MAX_CHARS = 3;
/** The channel must have had no kept text for this long before the line (it was "otherwise silent"). */
export const GHOST_ISOLATION_MS = 20_000;
/** For auto/multi sources the other channel must have spoken Latin text within this window. */
export const GHOST_CONTEXT_MS = 15_000;
/** Latin letters needed in the other channel's last text to call the meeting "Latin". */
export const GHOST_MIN_LATIN_LETTERS = 8;

/** Languages in which a CJK-only reply is legitimate: the filter does nothing for them. */
const CJK_LANGUAGES = new Set(["zh", "ja", "ko", "yue"]);
/** Sources where the language is not fixed, so only a Latin conversation on the other side counts. */
const OPEN_LANGUAGES = new Set(["auto", "multi", "detect"]);

const CJK_ONLY = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+$/u;
const NOT_LETTER_OR_DIGIT = /[^\p{L}\p{N}]/gu;
const LATIN_LETTER = /\p{Script=Latin}/gu;

interface Recent {
  endMs: number;
  text: string;
}

export interface GhostFilterOptions {
  /** Meeting source language code (`en`, `vi`, `auto`, ...). */
  sourceLang: string;
}

/**
 * Drops the lone CJK syllable ("嗯。") that STT hallucinates on a nearly silent mic in a Latin-script
 * meeting. Deliberately narrow: only CJK-only text of at most GHOST_MAX_CHARS, only after
 * GHOST_ISOLATION_MS without other text on the same channel, and (for open source languages) only
 * while the other channel is speaking Latin text. Latin words ("yes", "ok", "ừ", "vâng") never match.
 * One instance is shared by both channels of a session.
 */
export class GhostLineFilter {
  private readonly lastKept = new Map<Channel, Recent>();

  constructor(private readonly options: GhostFilterOptions) {}

  /** True when the segment is kept (and remembered); false when it is a ghost line. */
  accept(channel: Channel, text: string, startMs: number, endMs: number): boolean {
    if (this.isGhost(channel, text, startMs)) return false;
    this.lastKept.set(channel, { endMs, text });
    return true;
  }

  private isGhost(channel: Channel, text: string, startMs: number): boolean {
    const lang = this.options.sourceLang.toLowerCase();
    if (CJK_LANGUAGES.has(lang)) return false;
    const letters = text.replace(NOT_LETTER_OR_DIGIT, "");
    if (letters.length === 0 || letters.length > GHOST_MAX_CHARS || !CJK_ONLY.test(letters)) {
      return false;
    }
    const own = this.lastKept.get(channel);
    if (own && startMs - own.endMs < GHOST_ISOLATION_MS) return false;
    if (!OPEN_LANGUAGES.has(lang)) return true;
    return this.otherChannelIsLatin(channel, startMs);
  }

  private otherChannelIsLatin(channel: Channel, startMs: number): boolean {
    const other = this.lastKept.get(channel === 0 ? 1 : 0);
    if (!other || startMs - other.endMs > GHOST_CONTEXT_MS) return false;
    return (other.text.match(LATIN_LETTER)?.length ?? 0) >= GHOST_MIN_LATIN_LETTERS;
  }
}
