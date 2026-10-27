import type { MinutesContent, MinutesLang } from "@recap/core";
import type { Repositories } from "@recap/db";

/** One structured-output call. `jsonSchema` is the JSON Schema the reply must satisfy. */
export interface LlmRequest {
  system: string;
  user: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
}

/** One model call, for metering. */
export interface MinutesUsageEvent {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  status: "ok" | "error";
}

/** Metering hook; failures in it are swallowed by the caller. */
export type MinutesUsageHook = (event: MinutesUsageEvent) => void;

/** Seam for the minutes model. Returns the raw JSON text of the reply (parsing is the caller's). */
export interface MinutesLlm {
  readonly model: string;
  generate(request: LlmRequest): Promise<string>;
}

export type MinutesRepos = Pick<
  Repositories,
  "meetings" | "segments" | "translations" | "marks" | "notes" | "glossary"
>;

export interface GeneratorConfig {
  /** Transcripts above this many estimated tokens go through map-reduce. */
  singlePassMaxTokens: number;
  /** Target size of one map-reduce chunk (estimated tokens). */
  chunkTokens: number;
  markWindowBeforeMs: number;
  markWindowAfterMs: number;
  maxGlossaryTerms: number;
}

/** Where a generation is: chunk summaries (`map`), the merge (`reduce`), post-processing. */
export interface MinutesProgress {
  phase: "map" | "reduce" | "finalize";
  /** Chunks summarised so far. */
  done: number;
  /** Number of chunks (1 for a single-pass run). */
  total: number;
}

export interface MinutesDeps {
  repos: MinutesRepos;
  llm: MinutesLlm;
  /** Id factory for topics/actions/issues (default `crypto.randomUUID`). */
  newId?: () => string;
  config?: Partial<GeneratorConfig>;
  /** Called after each chunk and at reduce / finalize. Errors thrown by it are ignored. */
  onProgress?: (progress: MinutesProgress) => void;
}

export interface GenerateMinutesInput {
  meetingId: string;
  lang: MinutesLang;
}

export interface GeneratedMinutes {
  content: MinutesContent;
  model: string;
  /** `atMs` of marks that no decided conclusion could be tied to (the model missed them). */
  unmatchedMarks: number[];
  /** Version of the prompts used (see PROMPT_VERSION). */
  promptVersion: string;
  /** Fingerprint of the marks (conclusions + topic markers) the minutes were built from. */
  marksFingerprint: string;
  /** Fingerprint of the hand notes the minutes were built from. */
  notesFingerprint: string;
}
