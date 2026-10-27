import { describe, expect, it } from "vitest";
import { buildSettingsModel, budgetSetting } from "./settings-model";
import { NOTES_PER_MEETING_MAX, NOTE_CONTENT_MAX } from "@recap/core";
import { GUIDE_SECTIONS } from "./guide-content";
import { SETTINGS_TABS, parseTab } from "./settings-tab";

describe("settings model", () => {
  it("carries only the budget, never env values", () => {
    const model = buildSettingsModel({
      DEEPGRAM_API_KEY: "sk-secret",
      USAGE_MONTHLY_BUDGET_USD: "10",
    });
    expect(JSON.stringify(model)).not.toContain("sk-secret");
    expect(Object.keys(model)).toEqual(["budget"]);
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

describe("settings tabs", () => {
  it("lists guide, budget and users; guide is the default", () => {
    expect(SETTINGS_TABS).toEqual(["guide", "budget", "users"]);
    expect(parseTab(undefined, true)).toBe("guide");
    expect(parseTab("budget", true)).toBe("budget");
    expect(parseTab("users", true)).toBe("users");
    expect(parseTab("users", false)).toBe("guide");
  });

  it("the hidden providers and pricing tabs cannot be opened via ?tab=", () => {
    expect(parseTab("providers", true)).toBe("guide");
    expect(parseTab("pricing", true)).toBe("guide");
  });
});

describe("guide content", () => {
  const text = JSON.stringify(GUIDE_SECTIONS).toLowerCase();

  it("states the real note limits and shortcut keys", () => {
    expect(text).toContain(String(NOTES_PER_MEETING_MAX));
    expect(text).toContain(String(NOTE_CONTENT_MAX));
    expect(text).toContain("phím t");
    expect(text).toContain("phím k");
  });

  it("never mentions cost, prices, vendors or models", () => {
    for (const word of [
      "chi phí",
      "giá",
      "usd",
      "deepgram",
      "assemblyai",
      "openai",
      "gemini",
      "gpt",
      "hệ số",
    ]) {
      expect(text).not.toContain(word);
    }
  });
});
