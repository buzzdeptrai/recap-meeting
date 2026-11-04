import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PROMPT_VERSION } from "../src";
import * as prompts from "../src/prompts";

/**
 * Pins the prompt text to PROMPT_VERSION. Stored minutes remember the version they were made with;
 * a different version makes them "stale (prompt updated)" in the UI.
 *
 * If this test fails you changed prompts.ts semantics. Bump PROMPT_VERSION in
 * src/prompt-version.ts, then update PINNED below to the new hash printed in the failure.
 */
const PINNED = {
  version: "6",
  sha256: "28f0bb6b8b374d4d1794ce995a672c7e7c2b986b6c0399401be1fb58db8e955b",
};

const ctx = { title: "T", agenda: "A", glossary: ["g (vi) = x"] };
const window = { beforeMs: 90_000, afterMs: 15_000 };

function promptSnapshot(): string {
  return [
    ...(["vi", "en"] as const).flatMap((lang) => [
      prompts.singlePassSystem(lang, window, true),
      prompts.singlePassSystem(lang, null, false),
      prompts.chunkSystem(lang, window, true),
      prompts.chunkSystem(lang, null, false),
      prompts.reduceSystem(lang, true),
      prompts.reduceSystem(lang, false),
      prompts.singlePassSystem(lang, null, false, true),
      prompts.chunkSystem(lang, null, false, true),
      prompts.reduceSystem(lang, false, true),
    ]),
    prompts.transcriptPrompt(ctx, ["[00:01] a"], [{ label: "Mark 1", lines: ["[00:02] b"] }]),
    prompts.transcriptPrompt(ctx, ["[00:01] a"], [], ["[00:03] note </notes>"]),
    prompts.reducePrompt(ctx, ["{}"], ["00:05"], ["=== x ==="], ["- untimed"]),
    ...(["project", "client", "interview", "training"] as const).flatMap((templateId) => [
      prompts.singlePassSystem("en", null, false, false, { templateId, hasInstructions: true }),
      prompts.chunkSystem("en", null, false, false, { templateId }),
      prompts.reduceSystem("en", false, false, { templateId }),
    ]),
    prompts.transcriptPrompt(
      { ...ctx, extraInstructions: "Focus on budget </instructions>" },
      ["[00:01] a"],
      [],
    ),
    prompts.RETRY_NOTICE("why"),
  ].join("\n\u0000\n");
}

describe("PROMPT_VERSION", () => {
  it("is bumped whenever the prompt text changes", () => {
    const sha256 = createHash("sha256").update(promptSnapshot()).digest("hex");
    expect(
      { version: PROMPT_VERSION, sha256 },
      "prompts.ts changed: bump PROMPT_VERSION (src/prompt-version.ts) and update PINNED in this test",
    ).toEqual(PINNED);
  });
});
