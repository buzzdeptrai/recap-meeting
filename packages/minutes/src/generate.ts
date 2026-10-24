import { randomUUID } from "node:crypto";
import { DEFAULT_GENERATOR_CONFIG } from "./config";
import { MinutesError } from "./errors";
import type { LlmMinutes } from "./llm-schema";
import { postProcess } from "./postprocess";
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
} from "./types";

interface Plan {
  llm: MinutesLlm;
  lang: GenerateMinutesInput["lang"];
  config: GeneratorConfig;
  ctx: prompts.PromptContext;
  lines: TranscriptLine[];
  marks: number[];
  topics: TopicMarker[];
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
  return callStructured(plan.llm, {
    system: prompts.singlePassSystem(
      plan.lang,
      plan.marks.length > 0 ? windowSpec(plan) : null,
      plan.topics.length > 0,
    ),
    user: prompts.transcriptPrompt(plan.ctx, text, windowsFor(plan, plan.marks)),
  });
}

/** Marks belong to the chunk that contains their moment (the last chunk takes the tail). */
function marksOfChunk(chunks: TranscriptLine[][], index: number, marks: number[]): number[] {
  const start = index === 0 ? Number.NEGATIVE_INFINITY : (chunks[index]?.[0]?.startMs ?? 0);
  const next = chunks[index + 1]?.[0]?.startMs ?? Number.POSITIVE_INFINITY;
  return marks.filter((m) => m >= start && m < next);
}

async function mapReduce(plan: Plan): Promise<LlmMinutes> {
  const chunks = splitIntoChunks(plan.lines, plan.config.chunkTokens);
  const parts: string[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const marks = marksOfChunk(chunks, index, plan.marks);
    const part = await callStructured(plan.llm, {
      system: prompts.chunkSystem(
        plan.lang,
        marks.length > 0 ? windowSpec(plan) : null,
        plan.topics.length > 0,
      ),
      user: prompts.transcriptPrompt(
        plan.ctx,
        chunk.map((l) => l.text),
        windowsFor(plan, marks),
      ),
    });
    parts.push(JSON.stringify(part));
  }
  return callStructured(plan.llm, {
    system: prompts.reduceSystem(plan.lang, plan.topics.length > 0),
    user: prompts.reducePrompt(
      plan.ctx,
      parts,
      plan.marks.map(formatTimestamp),
      plan.topics.map(formatBoundary),
    ),
  });
}

function glossaryLines(deps: MinutesDeps, config: GeneratorConfig): string[] {
  return deps.repos.glossary
    .list()
    .slice(0, config.maxGlossaryTerms)
    .map((t) => {
      if (t.doNotTranslate) return `${t.term} (${t.lang}): keep as is`;
      return t.translation ? `${t.term} (${t.lang}) = ${t.translation}` : `${t.term} (${t.lang})`;
    });
}

/** Builds the minutes of an ended meeting. Reads via `deps.repos`; does not store the result. */
export async function generateMinutes(
  { meetingId, lang }: GenerateMinutesInput,
  deps: MinutesDeps,
): Promise<GeneratedMinutes> {
  const config = { ...DEFAULT_GENERATOR_CONFIG, ...deps.config };
  const meeting = deps.repos.meetings.get(meetingId);
  if (!meeting) throw new MinutesError("Meeting not found", "MEETING_NOT_FOUND");

  const segments = deps.repos.segments.listByMeeting(meetingId);
  const spoken = buildTranscriptLines(
    segments,
    deps.repos.translations.listByMeeting(meetingId),
    lang,
  );
  if (spoken.length === 0) throw new MinutesError("Meeting has no transcript", "EMPTY_TRANSCRIPT");

  const storedMarks = deps.repos.marks.list(meetingId);
  const marks = storedMarks.filter((m) => m.kind === "conclusion").map((m) => m.atMs);
  const topics = storedMarks
    .filter((m) => m.kind === "topic")
    .map((m) => ({ atMs: m.atMs, label: m.label }));
  const lines = withTopicBoundaries(spoken, topics);
  const ctx = {
    title: meeting.title,
    agenda: meeting.agenda,
    glossary: glossaryLines(deps, config),
  };
  const plan: Plan = { llm: deps.llm, lang, config, ctx, lines, marks, topics };

  const raw =
    totalTokens(lines) > config.singlePassMaxTokens
      ? await mapReduce(plan)
      : await singlePass(plan);
  const sourceText = [
    meeting.title,
    meeting.agenda ?? "",
    ...segments.map((s) => s.text),
    ...lines.map((l) => l.text),
  ].join("\n");
  const { content, unmatchedMarks } = postProcess(raw, {
    marks,
    window: { beforeMs: config.markWindowBeforeMs, afterMs: config.markWindowAfterMs },
    topics,
    maxAtMs: Math.max(...spoken.map((l) => l.endMs)),
    newId: deps.newId ?? randomUUID,
    sourceText,
  });
  return { content, model: deps.llm.model, unmatchedMarks };
}
