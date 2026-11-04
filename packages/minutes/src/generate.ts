import { randomUUID } from "node:crypto";
import { instructionsFingerprint, marksFingerprint, notesFingerprint } from "@recap/db";
import { DEFAULT_GENERATOR_CONFIG } from "./config";
import { MinutesError } from "./errors";
import { glossaryLines } from "./glossary-lines";
import type { LlmMinutes } from "./llm-schema";
import { buildNoteLines, notesOfChunk, untimedNotes, type NoteLine } from "./notes";
import { postProcess } from "./postprocess";
import { PROMPT_VERSION } from "./prompt-version";
import * as prompts from "./prompts";
import { callStructured } from "./structured";
import { formatBoundary, withTopicBoundaries, type TopicMarker } from "./topics";
import {
  buildTranscriptLines,
  formatTimestamp,
  markWindow,
  splitIntoChunks,
  totalTokens,
  type TranscriptLine,
} from "./transcript";
import type {
  GenerateMinutesInput,
  GeneratedMinutes,
  GeneratorConfig,
  MinutesDeps,
  MinutesLlm,
  MinutesProgress,
} from "./types";

interface Plan {
  llm: MinutesLlm;
  lang: GenerateMinutesInput["lang"];
  config: GeneratorConfig;
  ctx: prompts.PromptContext;
  lines: TranscriptLine[];
  marks: number[];
  topics: TopicMarker[];
  notes: NoteLine[];
  /** Template id + whether extra instructions exist: both steer every system prompt. */
  extras: prompts.SystemExtras;
  report: (progress: MinutesProgress) => void;
}

/** Progress sinks are best effort: a failing one must never fail the generation. */
function safeReporter(onProgress: MinutesDeps["onProgress"]): Plan["report"] {
  return (progress) => {
    if (!onProgress) return;
    try {
      onProgress({ ...progress });
    } catch {
      // ignored on purpose
    }
  };
}

const windowSpec = (plan: Plan) => ({
  beforeMs: plan.config.markWindowBeforeMs,
  afterMs: plan.config.markWindowAfterMs,
});

function windowsFor(plan: Plan, marks: number[]): prompts.MarkWindowText[] {
  const spec = windowSpec(plan);
  return marks.map((atMs, i) => ({
    label: `Mark ${i + 1} at [${formatTimestamp(atMs)}]`,
    lines: markWindow(plan.lines, atMs, spec, plan.marks).map((l) => l.text),
  }));
}

async function singlePass(plan: Plan): Promise<LlmMinutes> {
  const text = plan.lines.map((l) => l.text);
  plan.report({ phase: "map", done: 0, total: 1 });
  const result = await callStructured(plan.llm, {
    system: prompts.singlePassSystem(
      plan.lang,
      plan.marks.length > 0 ? windowSpec(plan) : null,
      plan.topics.length > 0,
      plan.notes.length > 0,
      plan.extras,
    ),
    user: prompts.transcriptPrompt(
      plan.ctx,
      text,
      windowsFor(plan, plan.marks),
      plan.notes.map((n) => n.text),
    ),
  });
  plan.report({ phase: "finalize", done: 1, total: 1 });
  return result;
}

/** Marks belong to the chunk that contains their moment (the last chunk takes the tail). */
function marksOfChunk(chunks: TranscriptLine[][], index: number, marks: number[]): number[] {
  const start = index === 0 ? Number.NEGATIVE_INFINITY : (chunks[index]?.[0]?.startMs ?? 0);
  const next = chunks[index + 1]?.[0]?.startMs ?? Number.POSITIVE_INFINITY;
  return marks.filter((m) => m >= start && m < next);
}

async function mapReduce(plan: Plan): Promise<LlmMinutes> {
  const chunks = splitIntoChunks(plan.lines, plan.config.chunkTokens);
  const total = chunks.length;
  const parts: string[] = [];
  plan.report({ phase: "map", done: 0, total });
  for (const [index, chunk] of chunks.entries()) {
    const marks = marksOfChunk(chunks, index, plan.marks);
    const notes = notesOfChunk(chunks, index, plan.notes);
    const part = await callStructured(plan.llm, {
      system: prompts.chunkSystem(
        plan.lang,
        marks.length > 0 ? windowSpec(plan) : null,
        plan.topics.length > 0,
        notes.length > 0,
        plan.extras,
      ),
      user: prompts.transcriptPrompt(
        plan.ctx,
        chunk.map((l) => l.text),
        windowsFor(plan, marks),
        notes.map((n) => n.text),
      ),
    });
    parts.push(JSON.stringify(part));
    plan.report({ phase: "map", done: index + 1, total });
  }
  plan.report({ phase: "reduce", done: total, total });
  const reduced = await callStructured(plan.llm, {
    system: prompts.reduceSystem(
      plan.lang,
      plan.topics.length > 0,
      plan.notes.length > 0,
      plan.extras,
    ),
    user: prompts.reducePrompt(
      plan.ctx,
      parts,
      plan.marks.map(formatTimestamp),
      plan.topics.map(formatBoundary),
      untimedNotes(plan.notes).map((n) => n.text),
    ),
  });
  plan.report({ phase: "finalize", done: total, total });
  return reduced;
}

/** Everything the model may legitimately quote; owners and dates are checked against it. */
function groundingText(
  meeting: { title: string; agenda: string | null },
  segments: ReadonlyArray<{ text: string }>,
  lines: ReadonlyArray<TranscriptLine>,
  notes: ReadonlyArray<NoteLine>,
): string {
  return [
    meeting.title,
    meeting.agenda ?? "",
    ...notes.map((n) => n.text),
    ...segments.map((s) => s.text),
    ...lines.map((l) => l.text),
  ].join("\n");
}

/** Conclusion marks as offsets, topic markers as boundaries. */
function splitMarks(stored: ReadonlyArray<{ kind: string; atMs: number; label: string | null }>) {
  return {
    marks: stored.filter((m) => m.kind === "conclusion").map((m) => m.atMs),
    topics: stored.filter((m) => m.kind === "topic").map((m) => ({ atMs: m.atMs, label: m.label })),
  };
}

function promptContextOf(
  meeting: { title: string; agenda: string | null; extraInstructions: string | null },
  glossary: string[],
): prompts.PromptContext {
  return {
    title: meeting.title,
    agenda: meeting.agenda,
    glossary,
    extraInstructions: meeting.extraInstructions,
  };
}

/** What the minutes were built from; compared later to detect stale minutes. */
function versionStamps(
  meeting: { templateId: string; extraInstructions: string | null },
  marks: Parameters<typeof marksFingerprint>[0],
  notes: Parameters<typeof notesFingerprint>[0],
) {
  return {
    promptVersion: PROMPT_VERSION,
    marksFingerprint: marksFingerprint(marks),
    notesFingerprint: notesFingerprint(notes),
    templateId: meeting.templateId,
    instructionsFingerprint: instructionsFingerprint(meeting.extraInstructions),
  };
}

type StoredMeeting = NonNullable<ReturnType<MinutesDeps["repos"]["meetings"]["get"]>>;

/** Everything one generation reads from the database, plus the plan the prompts are built from. */
function loadPlan(meeting: StoredMeeting, lang: GenerateMinutesInput["lang"], deps: MinutesDeps) {
  const config = { ...DEFAULT_GENERATOR_CONFIG, ...deps.config };
  const segments = deps.repos.segments.listByMeeting(meeting.id);
  const translations = deps.repos.translations.listByMeeting(meeting.id);
  const spoken = buildTranscriptLines(segments, translations, lang);
  if (spoken.length === 0) throw new MinutesError("Meeting has no transcript", "EMPTY_TRANSCRIPT");

  const storedMarks = deps.repos.marks.list(meeting.id);
  const { marks, topics } = splitMarks(storedMarks);
  const storedNotes = deps.repos.notes.list(meeting.id);
  const ctx = promptContextOf(meeting, glossaryLines(deps.repos, config.maxGlossaryTerms));
  const plan: Plan = {
    llm: deps.llm,
    lang,
    config,
    ctx,
    lines: withTopicBoundaries(spoken, topics),
    marks,
    topics,
    notes: buildNoteLines(storedNotes),
    extras: {
      templateId: meeting.templateId,
      hasInstructions: prompts.promptInstructions(ctx) !== null,
    },
    report: safeReporter(deps.onProgress),
  };
  return { plan, segments, spoken, storedMarks, storedNotes };
}

/** Builds the minutes of an ended meeting. Reads via `deps.repos`; does not store the result. */
export async function generateMinutes(
  { meetingId, lang }: GenerateMinutesInput,
  deps: MinutesDeps,
): Promise<GeneratedMinutes> {
  const meeting = deps.repos.meetings.get(meetingId);
  if (!meeting) throw new MinutesError("Meeting not found", "MEETING_NOT_FOUND");
  const { plan, segments, spoken, storedMarks, storedNotes } = loadPlan(meeting, lang, deps);
  const { config, lines, marks, topics, notes } = plan;

  const raw =
    totalTokens(lines) > config.singlePassMaxTokens
      ? await mapReduce(plan)
      : await singlePass(plan);
  const { content, unmatchedMarks } = postProcess(raw, {
    marks,
    window: { beforeMs: config.markWindowBeforeMs, afterMs: config.markWindowAfterMs },
    topics,
    maxAtMs: Math.max(...spoken.map((l) => l.endMs)),
    newId: deps.newId ?? randomUUID,
    sourceText: groundingText(meeting, segments, lines, notes),
  });
  return {
    content,
    model: deps.llm.model,
    unmatchedMarks,
    ...versionStamps(meeting, storedMarks, storedNotes),
  };
}
