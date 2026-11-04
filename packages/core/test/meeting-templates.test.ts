import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATE_ID,
  EXTRA_INSTRUCTIONS_MAX,
  MEETING_TEMPLATES,
  extraInstructionsSchema,
  getMeetingTemplate,
  meetingTemplateIdSchema,
  normalizeExtraInstructions,
  templateLabel,
} from "../src";

describe("meeting templates", () => {
  it("lists five Vietnamese-labelled templates with general first", () => {
    expect(MEETING_TEMPLATES.map((t) => t.id)).toEqual([
      "general",
      "project",
      "client",
      "interview",
      "training",
    ]);
    expect(DEFAULT_TEMPLATE_ID).toBe("general");
    expect(templateLabel("interview")).toBe("Phỏng vấn");
    expect(templateLabel("zzz")).toBe("zzz");
  });

  it("has presentation texts for every template", () => {
    for (const t of MEETING_TEMPLATES) {
      expect(t.tagline.length).toBeGreaterThan(0);
      expect(t.tagline.length).toBeLessThanOrEqual(60);
      expect(t.bestFor).not.toBe("");
      expect(t.focus).toHaveLength(3);
      for (const line of t.focus) expect(line.trim()).not.toBe("");
    }
    expect(getMeetingTemplate("client")?.label).toBe("Họp khách hàng");
    expect(getMeetingTemplate("zzz")).toBeUndefined();
  });

  it("rejects an unknown template id", () => {
    expect(meetingTemplateIdSchema.safeParse("project").success).toBe(true);
    expect(meetingTemplateIdSchema.safeParse("unknown").success).toBe(false);
  });

  it("limits and trims the extra instructions", () => {
    expect(extraInstructionsSchema.parse("  ok  ")).toBe("ok");
    expect(extraInstructionsSchema.safeParse("x".repeat(EXTRA_INSTRUCTIONS_MAX)).success).toBe(
      true,
    );
    expect(extraInstructionsSchema.safeParse("x".repeat(EXTRA_INSTRUCTIONS_MAX + 1)).success).toBe(
      false,
    );
  });

  it("normalizes whitespace and blank to null", () => {
    expect(normalizeExtraInstructions(" a \n\n b ")).toBe("a b");
    expect(normalizeExtraInstructions("  ")).toBeNull();
    expect(normalizeExtraInstructions(undefined)).toBeNull();
  });
});
