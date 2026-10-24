import { isAbsolute } from "node:path";
import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "../src/env";

const SECRET = "sk-super-secret-value";
const required = { DEEPGRAM_API_KEY: SECRET, OPENAI_API_KEY: SECRET, GEMINI_API_KEY: SECRET };

describe("parseEnv", () => {
  it("applies defaults and resolves data paths against the repo root", () => {
    const env = parseEnv(required);
    expect(env.REALTIME_PORT).toBe(4001);
    expect(env.DEEPGRAM_LANGUAGE).toBe("multi");
    expect(env.TRANSLATE_PROVIDER_ORDER).toEqual(["gemini", "openai"]);
    expect(env.TRANSLATE_DEADLINE_MS).toBe(1500);
    expect(env.ASSEMBLYAI_API_KEY).toBeUndefined();
    expect(isAbsolute(env.DB_PATH)).toBe(true);
    expect(env.DB_PATH.endsWith("/data/recap.db")).toBe(true);
  });

  it("coerces numbers and splits provider order", () => {
    const env = parseEnv({
      ...required,
      REALTIME_PORT: "5000",
      TRANSLATE_PROVIDER_ORDER: "openai, gemini",
    });
    expect(env.REALTIME_PORT).toBe(5000);
    expect(env.TRANSLATE_PROVIDER_ORDER).toEqual(["openai", "gemini"]);
  });

  it("leaves REALTIME_HOST unset by default and accepts a trimmed host", () => {
    expect(parseEnv(required).REALTIME_HOST).toBeUndefined();
    expect(parseEnv({ ...required, REALTIME_HOST: " 127.0.0.1 " }).REALTIME_HOST).toBe("127.0.0.1");
  });

  it("rejects an empty or whitespace-only REALTIME_HOST", () => {
    for (const REALTIME_HOST of ["", "   "]) {
      expect(() => parseEnv({ ...required, REALTIME_HOST })).toThrow(/REALTIME_HOST/);
    }
  });

  it("names every missing key without echoing any values", () => {
    const attempt = () =>
      parseEnv({ OPENAI_API_KEY: SECRET, GEMINI_API_KEY: "  ", REALTIME_PORT: "abc" });
    expect(attempt).toThrow(EnvError);
    try {
      attempt();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("DEEPGRAM_API_KEY");
      expect(message).toContain("GEMINI_API_KEY");
      expect(message).toContain("REALTIME_PORT");
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain("abc");
    }
  });

  it("defaults STT_PROVIDER to deepgram and AssemblyAI model to universal-3-6-pro", () => {
    const env = parseEnv(required);
    expect(env.STT_PROVIDER).toBe("deepgram");
    expect(env.ASSEMBLYAI_MODEL).toBe("universal-3-6-pro");
  });

  it("requires only the selected vendor's key, naming it without echoing values", () => {
    const others = { OPENAI_API_KEY: SECRET, GEMINI_API_KEY: SECRET };
    const env = parseEnv({ ...others, STT_PROVIDER: "assemblyai", ASSEMBLYAI_API_KEY: SECRET });
    expect(env.STT_PROVIDER).toBe("assemblyai");
    expect(env.DEEPGRAM_API_KEY).toBeUndefined();
    const attempt = () =>
      parseEnv({ ...others, DEEPGRAM_API_KEY: SECRET, STT_PROVIDER: "assemblyai" });
    expect(attempt).toThrow(/ASSEMBLYAI_API_KEY: is required when STT_PROVIDER=assemblyai/);
    expect(() => parseEnv({ ...others, STT_PROVIDER: "whisper" })).toThrow(/STT_PROVIDER/);
  });
});
