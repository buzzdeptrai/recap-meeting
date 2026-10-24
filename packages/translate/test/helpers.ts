import { DEFAULT_TRANSLATOR_CONFIG, type TranslatorConfig } from "../src";
import type { Clock } from "../src/types";

export function testConfig(overrides: Partial<TranslatorConfig> = {}): TranslatorConfig {
  return {
    ...DEFAULT_TRANSLATOR_CONFIG,
    providerOrder: ["gemini", "openai"],
    deadlineMs: 50,
    fallbackDeadlineMs: overrides.deadlineMs ?? 50,
    slowDeadlineMs: 0,
    orderTimeoutMs: 300,
    gemini: { apiKey: "test", model: "g" },
    openai: { apiKey: "test", model: "o" },
    ...overrides,
  };
}

export class ManualClock implements Clock {
  constructor(private t = 0) {}
  now(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
