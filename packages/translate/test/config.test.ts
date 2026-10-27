import { describe, expect, it } from "vitest";
import { TranslateConfigError, configFromEnv } from "../src";

const KEYS = { GEMINI_API_KEY: "g-secret", OPENAI_API_KEY: "o-secret" };

describe("configFromEnv", () => {
  it("applies documented defaults", () => {
    const c = configFromEnv(KEYS);
    expect(c.providerOrder).toEqual(["openai", "gemini"]);
    expect(c.deadlineMs).toBe(3000);
    expect(c.fallbackDeadlineMs).toBe(4000);
    expect(c.slowDeadlineMs).toBe(0);
    expect(
      configFromEnv({ ...KEYS, TRANSLATE_FALLBACK_DEADLINE_MS: "2500" }).fallbackDeadlineMs,
    ).toBe(2500);
    expect(configFromEnv({ ...KEYS, TRANSLATE_SLOW_DEADLINE_MS: "6000" }).slowDeadlineMs).toBe(
      6000,
    );
    expect(c.gemini.model).toBe("gemini-3.1-flash-lite");
    expect(c.openai.model).toBe("gpt-4.1-mini");
  });

  it("parses order, models and deadline, treating blanks as unset", () => {
    const c = configFromEnv({
      ...KEYS,
      TRANSLATE_PROVIDER_ORDER: " OpenAI , gemini,openai ",
      TRANSLATE_DEADLINE_MS: "900",
      GEMINI_MODEL: "",
      OPENAI_TRANSLATE_MODEL: "custom-model",
    });
    expect(c.providerOrder).toEqual(["openai", "gemini"]);
    expect(c.deadlineMs).toBe(900);
    expect(c.gemini.model).toBe("gemini-3.1-flash-lite");
    expect(c.openai.model).toBe("custom-model");
  });

  it("requires keys only for configured providers", () => {
    const c = configFromEnv({ GEMINI_API_KEY: "g", TRANSLATE_PROVIDER_ORDER: "gemini" });
    expect(c.providerOrder).toEqual(["gemini"]);
    expect(() => configFromEnv({ GEMINI_API_KEY: "g" })).toThrow(/OPENAI_API_KEY/);
  });

  it("rejects bad values without leaking secrets", () => {
    const bad = () =>
      configFromEnv({
        ...KEYS,
        TRANSLATE_PROVIDER_ORDER: "gemini,claude",
        TRANSLATE_DEADLINE_MS: "-5",
      });
    expect(bad).toThrow(TranslateConfigError);
    try {
      bad();
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("TRANSLATE_PROVIDER_ORDER");
      expect(msg).toContain("TRANSLATE_DEADLINE_MS");
      expect(msg).not.toContain("secret");
    }
  });
});
