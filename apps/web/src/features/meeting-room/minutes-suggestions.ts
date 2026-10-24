import { minutesContentSchema, type Mark } from "@recap/core";

/** A minutes item this close (ms) to a hand mark of the same kind is the same moment: hidden. */
export const DEDUPE_WINDOW_MS = 30_000;

export interface TopicSuggestion {
  id: string;
  title: string;
  /** Start of the topic: the earliest timed key point. */
  atMs: number;
}

/** AI-proposed conclusion (conclusions backed by a "K" mark are never listed). */
export interface ConclusionSuggestion {
  id: string;
  text: string;
  atMs: number;
}

export interface MinutesSuggestions {
  topics: TopicSuggestion[];
  conclusions: ConclusionSuggestion[];
}

export const NO_SUGGESTIONS: MinutesSuggestions = { topics: [], conclusions: [] };

function earliest(times: (number | null)[]): number | null {
  const timed = times.filter((t): t is number => t !== null);
  return timed.length === 0 ? null : Math.min(...timed);
}

/** Suggestion candidates from stored minutes content; anything unparsable gives no suggestions. */
export function extractSuggestions(content: unknown): MinutesSuggestions {
  const parsed = minutesContentSchema.safeParse(content);
  if (!parsed.success) return { topics: [], conclusions: [] };
  const result: MinutesSuggestions = { topics: [], conclusions: [] };
  for (const topic of parsed.data.topics) {
    const start = earliest(topic.keyPoints.map((p) => p.atMs));
    if (start === null) continue;
    result.topics.push({ id: topic.id, title: topic.title, atMs: start });
    const { conclusion } = topic;
    if (!conclusion || conclusion.marked) continue;
    result.conclusions.push({
      id: topic.id,
      text: conclusion.text,
      atMs: conclusion.atMs ?? start,
    });
  }
  return result;
}

function nearAny(atMs: number, marks: Mark[]): boolean {
  return marks.some((m) => Math.abs(m.atMs - atMs) <= DEDUPE_WINDOW_MS);
}

/** Candidates minus those that duplicate a hand mark of the same kind (recomputed as marks change). */
export function visibleSuggestions(all: MinutesSuggestions, marks: Mark[]): MinutesSuggestions {
  const topicMarks = marks.filter((m) => m.kind === "topic");
  const conclusionMarks = marks.filter((m) => m.kind === "conclusion");
  return {
    topics: all.topics.filter((t) => !nearAny(t.atMs, topicMarks)),
    conclusions: all.conclusions.filter((c) => !nearAny(c.atMs, conclusionMarks)),
  };
}
