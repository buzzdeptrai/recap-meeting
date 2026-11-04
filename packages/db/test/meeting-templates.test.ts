import { describe, expect, it } from "vitest";
import {
  instructionsFingerprint,
  minutesStaleReasons,
  type StaleInput,
  type VersionStamp,
} from "../src";
import { setup } from "./helpers";

describe("migration 014: meeting templates", () => {
  it("defaults existing-style meetings to the general template without instructions", () => {
    const { repos } = setup();
    const meeting = repos.meetings.create({ title: "Họp" });
    expect(meeting).toMatchObject({ templateId: "general", extraInstructions: null });
  });

  it("stores a template and trimmed instructions at creation", () => {
    const { repos } = setup();
    const meeting = repos.meetings.create({
      title: "PV",
      templateId: "interview",
      extraInstructions: "  Chú ý điểm mạnh  ",
    });
    expect(meeting).toMatchObject({
      templateId: "interview",
      extraInstructions: "Chú ý điểm mạnh",
    });
    expect(repos.meetings.get(meeting.id)?.templateId).toBe("interview");
    expect(repos.meetings.list()[0]?.extraInstructions).toBe("Chú ý điểm mạnh");
  });

  it("updates only the given settings; null or blank clears the instructions", () => {
    const { repos } = setup();
    const { id } = repos.meetings.create({ title: "x", extraInstructions: "a" });
    expect(repos.meetings.updateSettings(id, { templateId: "client" })).toMatchObject({
      templateId: "client",
      extraInstructions: "a",
    });
    expect(
      repos.meetings.updateSettings(id, { extraInstructions: "  " })?.extraInstructions,
    ).toBeNull();
    expect(repos.meetings.updateSettings(id, { extraInstructions: "b" })).toMatchObject({
      templateId: "client",
      extraInstructions: "b",
    });
    expect(
      repos.meetings.updateSettings(id, { extraInstructions: null })?.extraInstructions,
    ).toBeNull();
  });

  it("does not touch a soft-deleted meeting", () => {
    const { repos } = setup();
    const { id } = repos.meetings.create({ title: "x" });
    repos.meetings.softDelete(id);
    expect(repos.meetings.updateSettings(id, { templateId: "project" })).toBeUndefined();
  });

  it("stores template and instructions fingerprint with AI minutes only", () => {
    const { repos } = setup();
    const { id } = repos.meetings.create({ title: "x" });
    const content = { summary: "s", topics: [], actionItems: [], openIssues: [] };
    const ai = repos.minutes.upsert({
      meetingId: id,
      lang: "vi",
      content,
      source: "ai",
      templateId: "project",
      instructionsFingerprint: "fp",
    });
    expect(ai).toMatchObject({ templateId: "project", instructionsFingerprint: "fp" });
    const edited = repos.minutes.upsert({ meetingId: id, lang: "vi", content, source: "edited" });
    expect(edited).toMatchObject({ templateId: "project", instructionsFingerprint: "fp" });
  });
});

describe("instructionsFingerprint", () => {
  it("ignores surrounding and repeated whitespace and treats blank as none", () => {
    expect(instructionsFingerprint("  a \n b ")).toBe(instructionsFingerprint("a b"));
    expect(instructionsFingerprint(null)).toBe(instructionsFingerprint("   "));
    expect(instructionsFingerprint("a")).not.toBe(instructionsFingerprint("b"));
  });
});

describe("template / instructions staleness", () => {
  const stamp: VersionStamp = {
    promptVersion: "6",
    model: "m",
    marksFingerprint: "a",
    templateId: "general",
    instructionsFingerprint: "i1",
  };
  const base: StaleInput = {
    generatedAt: "2026-10-22T08:00:00.000Z",
    latestSegmentAt: null,
    latestMarkChangeAt: null,
    stored: stamp,
    current: stamp,
  };

  it("is fresh when nothing changed", () => {
    expect(minutesStaleReasons(base)).toEqual([]);
  });

  it("flags template_changed and instructions_changed independently", () => {
    expect(
      minutesStaleReasons({ ...base, current: { ...stamp, templateId: "interview" } }),
    ).toEqual(["template_changed"]);
    expect(
      minutesStaleReasons({ ...base, current: { ...stamp, instructionsFingerprint: "i2" } }),
    ).toEqual(["instructions_changed"]);
    expect(
      minutesStaleReasons({
        ...base,
        current: { ...stamp, templateId: "client", instructionsFingerprint: "i2" },
      }),
    ).toEqual(["template_changed", "instructions_changed"]);
  });

  it("never flags rows from before templates (NULL stored fields)", () => {
    const stored = { ...stamp, templateId: null, instructionsFingerprint: null };
    const current = { ...stamp, templateId: "client", instructionsFingerprint: "i2" };
    expect(minutesStaleReasons({ ...base, stored, current })).toEqual([]);
  });
});
