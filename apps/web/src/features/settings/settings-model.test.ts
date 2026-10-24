import { describe, expect, it } from "vitest";
import { buildSettingsModel, budgetSetting, priceText } from "./settings-model";

const PRICING = {
  version: 1 as const,
  currency: "USD" as const,
  entries: [
    {
      vendor: "deepgram" as const,
      service: "stt_live" as const,
      model: "nova-3",
      audioPerMinute: 0.0058,
      verified: true,
      source_url: "https://deepgram.com/pricing",
      updated_at: "2026-10-22",
    },
    {
      vendor: "gemini" as const,
      service: "translate" as const,
      model: "g",
      inputPer1M: 0.25,
      outputPer1M: 1.5,
      verified: false,
      source_url: "https://ai.google.dev/p",
      updated_at: "2026-10-22",
      notes: "n",
    },
  ],
};

const SECRET = "sk-super-secret-123";

describe("settings model", () => {
  it("never carries key values, only a mask and presence", () => {
    const model = buildSettingsModel(PRICING, {
      DEEPGRAM_API_KEY: SECRET,
      OPENAI_API_KEY: "  ",
      GEMINI_MODEL: "gemini-x",
    });
    expect(JSON.stringify(model)).not.toContain(SECRET);
    const byId = Object.fromEntries(model.providers.map((p) => [p.id, p]));
    expect(byId.deepgram).toMatchObject({ configured: true, maskedKey: "••••" });
    expect(byId.openai?.configured).toBe(false);
    expect(byId.assemblyai?.configured).toBe(false);
    expect(byId.gemini?.models[0]).toEqual({ env: "GEMINI_MODEL", set: true, value: "gemini-x" });
    expect(byId.deepgram?.models[0]).toMatchObject({ set: false, value: null });
  });

  it("formats prices and verification from pricing.json", () => {
    const rows = buildSettingsModel(PRICING, {}).pricing;
    expect(rows[0]).toMatchObject({
      price: "$0,0058 / phút kênh",
      verified: true,
      sourceHost: "deepgram.com",
    });
    expect(rows[1]?.price).toBe("vào $0,25 · ra $1,50 / 1 triệu token");
    expect(rows[1]).toMatchObject({ verified: false, notes: "n", service: "Dịch" });
    expect(priceText({ ...PRICING.entries[0]!, audioPerMinute: undefined })).toBe("–");
  });

  it("reads the budget from env with a default", () => {
    expect(budgetSetting({ USAGE_MONTHLY_BUDGET_USD: "100" })).toEqual({
      monthlyUsd: 100,
      fromEnv: true,
      alertUsd: 80,
    });
    expect(budgetSetting({})).toMatchObject({ monthlyUsd: 60, fromEnv: false });
    expect(budgetSetting({ USAGE_MONTHLY_BUDGET_USD: "-5" }).fromEnv).toBe(false);
  });
});
