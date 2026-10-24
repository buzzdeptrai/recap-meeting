import { minutesContentSchema, type MinutesContent } from "@recap/core";
import { MinutesError } from "./errors";
import type { LlmMinutes } from "./llm-schema";
import { parseTimestamp } from "./transcript";
import type { WindowSpec } from "./transcript";
import { applyTopicLabels, type TopicMarker } from "./topics";

export interface PostProcessContext {
  /** `atMs` of every user mark. */
  marks: number[];
  window: WindowSpec;
  /** Topic markers; labelled ones become the title of the topic that starts there. */
  topics?: TopicMarker[];
  /** Latest transcript timestamp; later `at` values are treated as hallucinated. */
  maxAtMs: number;
  newId: () => string;
  /** Text that owners/dates must be grounded in (transcript, title, agenda). */
  sourceText: string;
}

const DIGITS = /\d+/g;
const MARK_TOLERANCE_MS = 1_000;

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** Lowercase, strip Vietnamese/Latin diacritics so "Anh Minh" matches "anh minh". */
export function normalizeForMatch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
}

function resolveAt(at: string | null, ctx: PostProcessContext): number | null {
  const ms = parseTimestamp(at);
  if (ms === null) return null;
  return ms > ctx.maxAtMs + MARK_TOLERANCE_MS ? null : ms;
}

function groundedOwner(owner: string | null, ctx: PostProcessContext): string | null {
  const value = clean(owner);
  if (!value) return null;
  return normalizeForMatch(ctx.sourceText).includes(normalizeForMatch(value)) ? value : null;
}

/** A due date is kept only if every number in it is actually spoken in the meeting. */
function groundedDue(due: string | null, ctx: PostProcessContext): string | null {
  const value = clean(due);
  if (!value) return null;
  const spoken = new Set(ctx.sourceText.match(DIGITS) ?? []);
  const numbers = value.match(DIGITS) ?? [];
  return numbers.every((n) => spoken.has(n)) ? value : null;
}

function isBackedByMark(atMs: number | null, ctx: PostProcessContext): boolean {
  if (atMs === null) return false;
  return ctx.marks.some(
    (mark) => atMs >= mark - ctx.window.beforeMs && atMs <= mark + ctx.window.afterMs,
  );
}

function convertTopic(topic: LlmMinutes["topics"][number], ctx: PostProcessContext) {
  const conclusionAt = topic.conclusion ? resolveAt(topic.conclusion.at, ctx) : null;
  const conclusionText = clean(topic.conclusion?.text);
  return {
    id: ctx.newId(),
    title: topic.title.trim(),
    keyPoints: topic.keyPoints
      .filter((p) => clean(p.text))
      .map((p) => ({ text: p.text.trim(), atMs: resolveAt(p.at, ctx) })),
    status: topic.status,
    conclusion: conclusionText
      ? { text: conclusionText, atMs: conclusionAt, marked: isBackedByMark(conclusionAt, ctx) }
      : null,
  };
}

/** Marks that no marked conclusion points at: the model missed them. */
function findUnmatchedMarks(content: MinutesContent, ctx: PostProcessContext): number[] {
  const { beforeMs, afterMs } = ctx.window;
  return ctx.marks.filter(
    (mark) =>
      !content.topics.some((topic) => {
        const c = topic.conclusion;
        return (
          c?.marked && c.atMs !== null && c.atMs >= mark - beforeMs && c.atMs <= mark + afterMs
        );
      }),
  );
}

/**
 * Turns the model reply into validated MinutesContent: ids are assigned here (never by the
 * model), `marked` is derived from the real marks, owners/dates must be grounded in the text.
 */
export function postProcess(raw: LlmMinutes, ctx: PostProcessContext) {
  const candidate = {
    summary: raw.summary.trim(),
    topics: applyTopicLabels(
      raw.topics.filter((t) => clean(t.title)).map((t) => convertTopic(t, ctx)),
      ctx.topics ?? [],
    ),
    actionItems: raw.actionItems
      .filter((a) => clean(a.task))
      .map((a) => ({
        id: ctx.newId(),
        task: a.task.trim(),
        owner: groundedOwner(a.owner, ctx),
        due: groundedDue(a.due, ctx),
        atMs: resolveAt(a.at, ctx),
      })),
    openIssues: raw.openIssues
      .filter((i) => clean(i.text))
      .map((i) => ({ id: ctx.newId(), text: i.text.trim() })),
  };
  const parsed = minutesContentSchema.safeParse(candidate);
  if (!parsed.success) {
    const where = parsed.error.issues[0]?.path.join(".") ?? "root";
    throw new MinutesError(`Model output failed validation at "${where}"`, "INVALID_OUTPUT");
  }
  return { content: parsed.data, unmatchedMarks: findUnmatchedMarks(parsed.data, ctx) };
}
