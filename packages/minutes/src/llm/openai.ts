import OpenAI from "openai";
import type { OpenAiMinutesConfig } from "../config";
import { MinutesError } from "../errors";
import type { LlmRequest, MinutesLlm, MinutesUsageHook } from "../types";

const TEMPERATURE = 0.2;

/** The slice of the openai client used here (injectable for tests). */
export interface OpenAiClientLike {
  chat: {
    completions: {
      create(
        params: Record<string, unknown>,
        options: { signal: AbortSignal },
      ): Promise<{
        choices: { message: { content?: string | null } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
      }>;
    };
  };
}

export class OpenAiMinutesLlm implements MinutesLlm {
  readonly model: string;
  private readonly client: OpenAiClientLike;

  constructor(
    private readonly config: OpenAiMinutesConfig,
    client?: OpenAiClientLike,
    private readonly onUsage?: MinutesUsageHook,
  ) {
    this.model = config.model;
    this.client =
      client ??
      (new OpenAI({ apiKey: config.apiKey, maxRetries: 0 }) as unknown as OpenAiClientLike);
  }

  async generate(request: LlmRequest): Promise<string> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.deadlineMs);
    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          temperature: TEMPERATURE,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: request.schemaName, strict: true, schema: request.jsonSchema },
          },
        },
        { signal: controller.signal },
      );
      this.report("ok", startedAt, response.usage);
      return response.choices[0]?.message.content ?? "";
    } catch (err) {
      this.report("error", startedAt);
      if (controller.signal.aborted) {
        throw new MinutesError(`Minutes model exceeded ${this.config.deadlineMs}ms`, "LLM_FAILED");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Metering must never affect the call: any hook failure is swallowed. */
  private report(
    status: "ok" | "error",
    startedAt: number,
    usage?: { prompt_tokens?: number; completion_tokens?: number } | null,
  ): void {
    try {
      this.onUsage?.({
        model: this.model,
        inputTokens: usage?.prompt_tokens ?? null,
        outputTokens: usage?.completion_tokens ?? null,
        latencyMs: Date.now() - startedAt,
        status,
      });
    } catch (err) {
      console.error("[minutes] usage hook failed:", err instanceof Error ? err.message : "unknown");
    }
  }
}
