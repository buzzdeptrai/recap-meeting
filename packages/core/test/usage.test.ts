import { describe, expect, it } from "vitest";
import { loadPricingFile } from "../src/node";
import { computeCostUsd } from "../src";

describe("pricing", () => {
  const pricing = loadPricingFile();

  it("config/pricing.json is valid", () => {
    expect(pricing.entries.length).toBeGreaterThan(0);
  });

  it("prices Deepgram by channel-seconds", () => {
    const cost = computeCostUsd(
      { vendor: "deepgram", service: "stt_live", model: "nova-3", audioSeconds: 120 },
      pricing,
    );
    expect(cost).toBeCloseTo(2 * 0.0058, 8);
  });

  it("uses the monolingual price for single-language sessions", () => {
    const cost = computeCostUsd(
      {
        vendor: "deepgram",
        service: "stt_live",
        model: "nova-3",
        audioSeconds: 60,
        meta: { language: "vi" },
      },
      pricing,
    );
    expect(cost).toBeCloseTo(0.0048, 8);
  });

  it("prices tokens per million and returns null without a price", () => {
    const base = {
      vendor: "openai",
      service: "minutes",
      inputTokens: 500_000,
      outputTokens: 100_000,
    } as const;
    expect(computeCostUsd({ ...base, model: "gpt-4.1" }, pricing)).toBeCloseTo(1 + 0.8, 8);
    expect(computeCostUsd({ ...base, model: "unknown" }, pricing)).toBeNull();
    expect(
      computeCostUsd({ ...base, model: "gpt-4.1", inputTokens: null, outputTokens: null }, pricing),
    ).toBeNull();
  });
});
