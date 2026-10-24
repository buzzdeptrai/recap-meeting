import { describe, expect, it } from "vitest";
import { FakeProvider, createTranslator, type TranslationUsageEvent } from "../src";
import { GeminiProvider } from "../src/providers/gemini";
import { OpenAIProvider } from "../src/providers/openai";
import { testConfig } from "./helpers";

const input = {
  meetingId: "m1",
  sourceLang: "en",
  targetLang: "vi",
  seq: 1,
  text: "hello",
} as const;

function setup(
  gemini: FakeProvider,
  openai: FakeProvider,
  onUsage: (e: TranslationUsageEvent) => void,
) {
  return createTranslator(testConfig({ deadlineMs: 1000 }), {
    providers: { gemini, openai },
    onUsage,
  });
}

describe("translation usage events", () => {
  it("emits an ok event with tokens, model and meeting id for the primary", async () => {
    const events: TranslationUsageEvent[] = [];
    const t = setup(
      new FakeProvider("gemini", { usage: { inputTokens: 120, outputTokens: 30 } }),
      new FakeProvider("openai"),
      (e) => events.push(e),
    );
    await t.translate(input);
    expect(events).toEqual([
      expect.objectContaining({
        meetingId: "m1",
        provider: "gemini",
        model: "fake-gemini",
        inputTokens: 120,
        outputTokens: 30,
        status: "ok",
      }),
    ]);
    expect(events[0]?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("emits error for the failed primary and fallback for the secondary", async () => {
    const events: TranslationUsageEvent[] = [];
    const t = setup(
      new FakeProvider("gemini", { error: "SERVER" }),
      new FakeProvider("openai", { usage: { inputTokens: 5, outputTokens: 2 } }),
      (e) => events.push(e),
    );
    await t.translate(input);
    expect(events.map((e) => [e.provider, e.status])).toEqual([
      ["gemini", "error"],
      ["openai", "fallback"],
    ]);
    expect(events[0]).toMatchObject({ errorCode: "SERVER", inputTokens: null });
    expect(events[1]).toMatchObject({ inputTokens: 5, outputTokens: 2 });
  });

  it("emits two error events when every provider fails", async () => {
    const events: TranslationUsageEvent[] = [];
    const t = setup(
      new FakeProvider("gemini", { error: "SERVER" }),
      new FakeProvider("openai", { error: "RATE_LIMIT" }),
      (e) => events.push(e),
    );
    await expect(t.translate(input)).rejects.toThrow();
    expect(events.map((e) => e.status)).toEqual(["error", "error"]);
  });

  it("never breaks translation when the recorder throws", async () => {
    const t = setup(new FakeProvider("gemini"), new FakeProvider("openai"), () => {
      throw new Error("db locked");
    });
    await expect(t.translate(input)).resolves.toMatchObject({ provider: "gemini" });
  });
});

describe("provider token mapping", () => {
  it("gemini adds thinking tokens to output", async () => {
    const p = new GeminiProvider({
      apiKey: "k",
      model: "m",
      client: {
        models: {
          generateContent: async () => ({
            text: "x",
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, thoughtsTokenCount: 6 },
          }),
        },
      },
    });
    expect(
      (await p.translate({ systemPrompt: "s", userPrompt: "u" }, { deadlineMs: 100 })).usage,
    ).toEqual({ inputTokens: 10, outputTokens: 10 });
  });

  it("openai maps usage", async () => {
    const p = new OpenAIProvider({
      apiKey: "k",
      model: "m",
      client: {
        chat: {
          completions: {
            create: async () => ({
              choices: [{ message: { content: "x" } }],
              usage: { prompt_tokens: 7, completion_tokens: 3 },
            }),
          },
        },
      },
    });
    expect(
      (await p.translate({ systemPrompt: "s", userPrompt: "u" }, { deadlineMs: 100 })).usage,
    ).toEqual({ inputTokens: 7, outputTokens: 3 });
  });
});
