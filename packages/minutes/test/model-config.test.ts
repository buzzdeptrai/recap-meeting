import { describe, expect, it } from "vitest";
import { minutesModelFromEnv } from "../src";

describe("minutesModelFromEnv", () => {
  it("returns the configured model without needing an API key", () => {
    expect(minutesModelFromEnv({ OPENAI_MINUTES_MODEL: "gpt-x" })).toBe("gpt-x");
  });
  it("falls back to the default for unset or blank values", () => {
    expect(minutesModelFromEnv({})).toBe("gpt-4.1");
    expect(minutesModelFromEnv({ OPENAI_MINUTES_MODEL: "  " })).toBe("gpt-4.1");
  });
  it("returns null when the config is invalid", () => {
    expect(minutesModelFromEnv({ OPENAI_MINUTES_DEADLINE_MS: "abc" })).toBeNull();
  });
});
