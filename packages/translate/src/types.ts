/** Languages a glossary term or translation can be in. */
export type Lang = "vi" | "en";

/** Fully built prompts handed to a provider; providers know nothing about meetings. */
export interface TranslationRequest {
  systemPrompt: string;
  userPrompt: string;
  /** Only used to attribute usage events; never sent to a provider. */
  meetingId?: string;
}

/** Token counts reported by the vendor for one call (absent when it reports none). */
export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface TranslationOutput {
  text: string;
  usage?: TokenUsage;
}

/** One provider attempt, for metering. `fallback` = answered by a non-primary provider. */
export interface TranslationUsageEvent {
  meetingId?: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  status: "ok" | "error" | "fallback";
  errorCode?: string;
}

/** Receives usage events; must not be relied on: failures are swallowed by the caller. */
export type UsageHook = (event: TranslationUsageEvent) => void;

export interface ProviderCallOptions {
  /** Cancels the call from the outside (e.g. meeting ended). */
  signal?: AbortSignal;
  /** Hard deadline for this single call; the provider aborts itself when it elapses. */
  deadlineMs: number;
}

/** An external translation service. Implementations: gemini, openai, fake. */
export interface TranslationProvider {
  readonly name: string;
  /** Model id, reported in usage events. */
  readonly model?: string;
  translate(req: TranslationRequest, options: ProviderCallOptions): Promise<TranslationOutput>;
}

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export interface Logger {
  warn(message: string, meta?: Record<string, unknown>): void;
}

export const noopLogger: Logger = { warn: () => undefined };
