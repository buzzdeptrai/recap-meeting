import { ProviderError, type ProviderErrorCode } from "../errors";
import type {
  ProviderCallOptions,
  TranslationOutput,
  TranslationProvider,
  TranslationRequest,
} from "../types";
import { runWithDeadline } from "./deadline";

export interface FakeStep {
  /** Simulated latency before answering (default 0). */
  latencyMs?: number;
  /** Fixed answer; default echoes the [LATEST TEXT] block. */
  text?: string;
  /** Token usage reported with the answer. */
  usage?: { inputTokens?: number; outputTokens?: number };
  /** Fail with this code instead of answering. */
  error?: ProviderErrorCode;
}

export type FakeScript =
  FakeStep | FakeStep[] | ((req: TranslationRequest, call: number) => FakeStep);

const LATEST_MARKER = /\[LATEST TEXT TO TRANSLATE\]:\n([\s\S]*)$/;

function echoLatest(req: TranslationRequest): string {
  const latest = LATEST_MARKER.exec(req.userPrompt)?.[1] ?? req.userPrompt;
  return `[fake] ${latest.trim()}`;
}

/** Scriptable provider for tests: per-call latency, errors, answers. Honors deadline/abort. */
export class FakeProvider implements TranslationProvider {
  readonly calls: TranslationRequest[] = [];

  constructor(
    readonly name: string,
    private readonly script: FakeScript = {},
    readonly model: string = `fake-${name}`,
  ) {}

  async translate(
    req: TranslationRequest,
    { signal, deadlineMs }: ProviderCallOptions,
  ): Promise<TranslationOutput> {
    const call = this.calls.push(req) - 1;
    const step = this.stepFor(req, call);
    return runWithDeadline(this.name, deadlineMs, signal, async (abortSignal) => {
      await sleep(step.latencyMs ?? 0, abortSignal);
      if (step.error) throw new ProviderError(`fake ${step.error}`, step.error, this.name);
      return { text: step.text ?? echoLatest(req), usage: step.usage };
    });
  }

  private stepFor(req: TranslationRequest, call: number): FakeStep {
    if (typeof this.script === "function") return this.script(req, call);
    if (!Array.isArray(this.script)) return this.script;
    return this.script[Math.min(call, this.script.length - 1)] ?? {};
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
