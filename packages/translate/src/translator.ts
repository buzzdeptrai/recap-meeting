import type { SourceLang, TargetLang } from "@recap/core";
import { CircuitBreaker } from "./circuit-breaker";
import type { TranslatorConfig } from "./config";
import { ContextStore } from "./context";
import { TranslateInputError } from "./errors";
import { createGlossary, type Glossary, type GlossarySource } from "./glossary";
import { OrderingGate } from "./ordering";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { createProviders } from "./providers";
import { createRouter } from "./router";
import {
  noopLogger,
  systemClock,
  type Clock,
  type Logger,
  type TranslationProvider,
  type UsageHook,
} from "./types";

export interface TranslateInput {
  meetingId: string;
  /** Segment sequence number, strictly ordering results within a meeting. */
  seq: number;
  text: string;
  sourceLang: SourceLang;
  targetLang: TargetLang;
}

export interface TranslateResult {
  text: string;
  provider: string;
  latencyMs: number;
  /** True when the answering provider is not the primary. */
  degraded: boolean;
}

export interface TranslatorStatus {
  provider: string;
  degraded: boolean;
}

export interface Translator {
  translate(input: TranslateInput): Promise<TranslateResult>;
  /** Current serving provider, for the WS `status` event. */
  status(): TranslatorStatus;
  /** Drops context and ordering state of a finished meeting. */
  endMeeting(meetingId: string): void;
}

export interface TranslatorDeps {
  /** Replaces the real gemini/openai providers (tests, alternative backends). */
  providers?: Record<string, TranslationProvider>;
  glossary?: GlossarySource;
  /** Metering hook (one event per provider attempt). Errors thrown here are swallowed. */
  onUsage?: UsageHook;
  clock?: Clock;
  logger?: Logger;
}

function buildRouter(config: TranslatorConfig, deps: TranslatorDeps, clock: Clock, logger: Logger) {
  return createRouter({
    providers: deps.providers ?? createProviders(config),
    order: config.providerOrder,
    deadlineMs: config.deadlineMs,
    fallbackDeadlineMs: config.fallbackDeadlineMs,
    slowDeadlineMs: config.slowDeadlineMs,
    breaker: new CircuitBreaker(config.breaker, clock),
    clock,
    logger,
    onUsage: deps.onUsage,
  });
}

export function createTranslator(config: TranslatorConfig, deps: TranslatorDeps = {}): Translator {
  const clock = deps.clock ?? systemClock;
  const logger = deps.logger ?? noopLogger;
  const router = buildRouter(config, deps, clock, logger);
  const glossary: Glossary | null = deps.glossary
    ? createGlossary({ source: deps.glossary, maxTerms: config.glossaryMaxTerms, clock, logger })
    : null;
  const context = new ContextStore(config.contextSize);
  const gate = new OrderingGate(config.orderTimeoutMs, logger);

  async function translate(input: TranslateInput): Promise<TranslateResult> {
    const text = input.text.trim();
    if (!text) throw new TranslateInputError("Cannot translate empty text");
    // Registered synchronously (before any await) so arrival order defines who is "earlier".
    const ticket = gate.register(input.meetingId, input.seq);
    try {
      const matches = glossary
        ? await glossary.select(text, input.sourceLang, input.targetLang)
        : [];
      const result = await router.translate({
        meetingId: input.meetingId,
        systemPrompt: buildSystemPrompt(input.sourceLang, input.targetLang),
        userPrompt: buildUserPrompt({
          text,
          context: context.recent(input.meetingId),
          glossaryLines: glossary ? glossary.lines(matches) : [],
        }),
      });
      const { inOrder } = await ticket.release();
      if (inOrder) context.push(input.meetingId, { source: text, translation: result.text });
      return result;
    } catch (err) {
      ticket.fail();
      throw err;
    }
  }

  return {
    translate,
    status: () => router.status(),
    endMeeting(meetingId) {
      context.clear(meetingId);
      gate.clear(meetingId);
    },
  };
}
