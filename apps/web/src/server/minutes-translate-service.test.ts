import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { FakeMinutesLlm } from "@recap/minutes";
import { beforeEach, describe, expect, it } from "vitest";
import { getMinutes, saveEditedMinutes } from "./minutes-service";
import type { MinutesRunDeps } from "./minutes-run-service";
import { startMinutesRun } from "./minutes-run-service";
import { startTranslationRun } from "./minutes-translate-service";
import { testWorker } from "./minutes-test-support";
import type { ServiceError } from "./service-error";

const reply = {
  summary: "Price agreed.",
  topics: [
    {
      title: "Price",
      keyPoints: [{ text: "Discount 5%", at: "00:03" }],
      status: "decided",
      conclusion: { text: "Price is 95", at: "00:05", marked: true },
    },
  ],
  actionItems: [],
  openIssues: [],
};
const translated = {
  summary: "Đã thống nhất giá.",
  topics: [{ title: "Giá", keyPoints: ["Giảm 5%"], conclusion: "Giá là 95" }],
  actionItems: [],
  openIssues: [],
};

let repos: Repositories;
const deps = (): MinutesRunDeps => ({ repos, requireModel: () => "model-x" });
const fail = (status: number, code: string) =>
  expect.objectContaining({ status, code }) as unknown as ServiceError;

function endedMeeting() {
  const meeting = repos.meetings.create({ title: "Họp" });
  repos.meetings.start(meeting.id);
  repos.meetings.end(meeting.id);
  repos.segments.insert({
    meetingId: meeting.id,
    seq: 0,
    channel: 1,
    lang: "en",
    startMs: 3_000,
    endMs: 5_000,
    text: "Price is 95",
  });
  return meeting.id;
}

/** Runs everything queued, as the realtime worker would. */
async function runQueue() {
  const worker = testWorker(repos, () => new FakeMinutesLlm(reply), {
    createTranslateLlm: () => new FakeMinutesLlm(translated),
  });
  while (worker.tick() > 0) await worker.whenIdle();
  await worker.whenIdle();
}

beforeEach(() => {
  repos = createRepositories(openDatabase(IN_MEMORY));
});

describe("translation staleness", () => {
  it("source generation derives the other language, which is fresh until the source is edited", async () => {
    const id = endedMeeting();
    startMinutesRun(id, "en", deps());
    await runQueue();
    const derived = getMinutes(id, "vi", { repos });
    expect(derived).toMatchObject({ derivedFromLang: "en", stale: false, staleReasons: [] });
    expect(getMinutes(id, "en", { repos }).derivedFromLang).toBeNull();

    const source = getMinutes(id, "en", { repos });
    saveEditedMinutes(id, "en", { ...source.content, summary: "Edited." }, { repos });
    expect(getMinutes(id, "vi", { repos })).toMatchObject({
      stale: true,
      staleReasons: ["source_edited"],
    });
  });

  it("editing the translation never touches the source and keeps provenance", async () => {
    const id = endedMeeting();
    startMinutesRun(id, "en", deps());
    await runQueue();
    const before = getMinutes(id, "en", { repos });
    const derived = getMinutes(id, "vi", { repos });
    const saved = saveEditedMinutes(
      id,
      "vi",
      { ...derived.content, summary: "Sửa tay." },
      { repos },
    );
    expect(saved).toMatchObject({ source: "edited", derivedFromLang: "en", stale: false });
    expect(getMinutes(id, "en", { repos })).toEqual(before);
  });

  it("a source row never reports source_edited; legacy rows without provenance stay fresh", () => {
    const id = endedMeeting();
    repos.minutes.upsert({
      meetingId: id,
      lang: "vi",
      content: { summary: "x", topics: [], actionItems: [], openIssues: [] },
      source: "ai",
    });
    expect(getMinutes(id, "vi", { repos }).derivedFromLang).toBeNull();
    expect(getMinutes(id, "vi", { repos }).staleReasons).not.toContain("source_edited");
  });
});

describe("startTranslationRun", () => {
  it("needs ended meeting and existing source minutes", () => {
    const id = endedMeeting();
    expect(() => startTranslationRun(id, "vi", {}, deps())).toThrow(fail(409, "SOURCE_MISSING"));
    expect(() => startTranslationRun("nope", "vi", {}, deps())).toThrow(fail(404, "NOT_FOUND"));
  });

  it("queues a translate run (idempotent while active) for retry and re-translate", async () => {
    const id = endedMeeting();
    startMinutesRun(id, "en", deps());
    await runQueue();
    const run = startTranslationRun(id, "vi", {}, deps());
    expect(run).toMatchObject({ kind: "translate", lang: "vi", status: "queued" });
    expect(startTranslationRun(id, "vi", {}, deps()).runId).toBe(run.runId);
    await runQueue();
    expect(repos.minutesRuns.get(run.runId)?.status).toBe("done");
  });

  it("refuses to overwrite hand edits without confirmation, accepts with it", async () => {
    const id = endedMeeting();
    startMinutesRun(id, "en", deps());
    await runQueue();
    const derived = getMinutes(id, "vi", { repos });
    saveEditedMinutes(id, "vi", { ...derived.content, summary: "Sửa tay." }, { repos });

    expect(() => startTranslationRun(id, "vi", {}, deps())).toThrow(fail(409, "DERIVED_EDITED"));
    expect(repos.minutes.get(id, "vi")?.content.summary).toBe("Sửa tay.");

    const run = startTranslationRun(id, "vi", { confirmOverwrite: true }, deps());
    expect(repos.minutesRuns.get(run.runId)).toMatchObject({ overwrite: true });
    await runQueue();
    expect(getMinutes(id, "vi", { repos })).toMatchObject({ source: "ai", stale: false });
  });

  it("generating a language while it is being translated is a conflict, and the reverse", async () => {
    const id = endedMeeting();
    startMinutesRun(id, "en", deps());
    await runQueue();
    startTranslationRun(id, "vi", {}, deps());
    expect(() => startMinutesRun(id, "vi", deps())).toThrow(fail(409, "RUN_BUSY"));
  });
});
