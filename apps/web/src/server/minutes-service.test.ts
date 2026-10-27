import {
  IN_MEMORY,
  createRepositories,
  marksFingerprint,
  notesFingerprint,
  openDatabase,
  type Repositories,
} from "@recap/db";
import { FakeMinutesLlm, PROMPT_VERSION } from "@recap/minutes";
import { beforeEach, describe, expect, it } from "vitest";
import { generateNow } from "./minutes-test-support";
import { getMinutes, saveEditedMinutes } from "./minutes-service";
import type { ServiceError } from "./service-error";

const reply = {
  summary: "Chốt giá.",
  topics: [
    {
      title: "Giá",
      keyPoints: [{ text: "Giảm 5%", at: "00:03" }],
      status: "decided",
      conclusion: { text: "Chốt 95", at: "00:05", marked: true },
    },
  ],
  actionItems: [],
  openIssues: [],
};

let repos: Repositories;
const llm = () => new FakeMinutesLlm(reply);
const fail = (status: number, code: string) =>
  expect.objectContaining({ status, code }) as unknown as ServiceError;

function endedMeeting(withSegments = true) {
  const meeting = repos.meetings.create({ title: "Họp" });
  repos.meetings.start(meeting.id);
  repos.meetings.end(meeting.id);
  if (withSegments) {
    repos.segments.insert({
      meetingId: meeting.id,
      seq: 0,
      channel: 1,
      lang: "vi",
      startMs: 3_000,
      endMs: 5_000,
      text: "Chốt 95 triệu",
    });
    repos.marks.insert({ meetingId: meeting.id, kind: "conclusion", atMs: 6_000 });
  }
  return meeting.id;
}

beforeEach(() => {
  repos = createRepositories(openDatabase(IN_MEMORY));
});

describe("getMinutes / saveEditedMinutes", () => {
  it("404 for unknown meeting and for missing minutes", () => {
    expect(() => getMinutes("nope", "vi", { repos })).toThrow(fail(404, "NOT_FOUND"));
    const id = endedMeeting();
    expect(() => getMinutes(id, "en", { repos })).toThrow(fail(404, "MINUTES_NOT_FOUND"));
    expect(() =>
      saveEditedMinutes(
        id,
        "en",
        { summary: "x", topics: [], actionItems: [], openIssues: [] },
        { repos },
      ),
    ).toThrow(fail(404, "MINUTES_NOT_FOUND"));
  });

  it("stores an edit with source edited and keeps the other language untouched", async () => {
    const id = endedMeeting();
    await generateNow(repos, id, "vi", llm);
    await generateNow(repos, id, "en", llm);
    const vi = getMinutes(id, "vi", { repos });
    const edited = saveEditedMinutes(id, "vi", { ...vi.content, summary: "Đã sửa" }, { repos });
    expect(edited).toMatchObject({ source: "edited", generatedAt: vi.generatedAt });
    expect(edited.content.summary).toBe("Đã sửa");
    expect(getMinutes(id, "en", { repos }).source).toBe("ai");
  });
});

describe("minutes staleness", () => {
  const TICK_MS = 1_000;
  let clock = Date.parse("2026-10-22T08:00:00.000Z");

  function timedRepos() {
    return createRepositories(openDatabase(IN_MEMORY), {
      now: () => new Date((clock += TICK_MS)).toISOString(),
    });
  }

  async function generated() {
    const timed = timedRepos();
    const meeting = timed.meetings.create({ title: "Họp" });
    timed.meetings.start(meeting.id);
    timed.meetings.end(meeting.id);
    timed.segments.insert({
      meetingId: meeting.id,
      seq: 0,
      channel: 1,
      lang: "vi",
      startMs: 3_000,
      endMs: 5_000,
      text: "Chốt 95 triệu",
    });
    const deps = { repos: timed };
    await generateNow(timed, meeting.id, "vi", llm);
    return { timed, id: meeting.id, deps, dto: getMinutes(meeting.id, "vi", deps) };
  }

  it("is fresh right after generation", async () => {
    const { id, deps, dto } = await generated();
    expect(dto.stale).toBe(false);
    expect(getMinutes(id, "vi", deps).stale).toBe(false);
  });

  it("becomes stale when a segment is added after generation, fresh again after regenerating", async () => {
    const { timed, id, deps } = await generated();
    timed.segments.insert({
      meetingId: id,
      seq: 1,
      channel: 0,
      lang: "vi",
      startMs: 9_000,
      endMs: 10_000,
      text: "Phần ghi tiếp",
    });
    expect(getMinutes(id, "vi", deps).stale).toBe(true);
    await generateNow(timed, id, "vi", llm);
    expect(getMinutes(id, "vi", deps).stale).toBe(false);
  });

  it("becomes stale when a topic marker is added or renamed, and stays stale after a user edit", async () => {
    const { timed, id, deps, dto } = await generated();
    const mark = timed.marks.insert({ meetingId: id, kind: "topic", atMs: 1_000 });
    expect(getMinutes(id, "vi", deps).stale).toBe(true);
    expect(saveEditedMinutes(id, "vi", dto.content, deps).stale).toBe(true);
    await generateNow(timed, id, "vi", llm);
    expect(getMinutes(id, "vi", deps).stale).toBe(false);
    timed.marks.updateLabel(id, mark.id, "Chủ đề mới");
    expect(getMinutes(id, "vi", deps).stale).toBe(true);
  });
});

describe("version-based staleness", () => {
  async function fresh() {
    const id = endedMeeting();
    await generateNow(repos, id, "vi", llm);
    return { id, deps: { repos } };
  }

  it("stores the prompt version and marks fingerprint at generation", async () => {
    const { id } = await fresh();
    const stored = repos.minutes.get(id, "vi");
    expect(stored?.promptVersion).toBe(PROMPT_VERSION);
    expect(stored?.marksFingerprint).toBe(marksFingerprint(repos.marks.list(id)));
  });

  it("is fresh with matching model, and lists no reasons", async () => {
    const { id } = await fresh();
    const dto = getMinutes(id, "vi", { repos, currentModel: () => "fake-model" });
    expect(dto).toMatchObject({ stale: false, staleReasons: [] });
  });

  it("flags a deleted mark (marks_removed)", async () => {
    const { id } = await fresh();
    const mark = repos.marks.list(id)[0];
    repos.marks.remove(id, mark?.id ?? "");
    expect(getMinutes(id, "vi", { repos })).toMatchObject({
      stale: true,
      staleReasons: ["marks_removed"],
    });
  });

  it("stores the notes fingerprint at generation", async () => {
    const id = endedMeeting();
    repos.notes.insert({ meetingId: id, atMs: 1_000, content: "ghi chú" });
    await generateNow(repos, id, "vi", llm);
    expect(repos.minutes.get(id, "vi")?.notesFingerprint).toBe(
      notesFingerprint(repos.notes.list(id)),
    );
  });

  it("flags a note added, edited or deleted after generation (notes_changed)", async () => {
    const { id } = await fresh();
    const note = repos.notes.insert({ meetingId: id, atMs: 1_000, content: "mới" });
    expect(getMinutes(id, "vi", { repos }).staleReasons).toEqual(["notes_changed"]);

    await generateNow(repos, id, "vi", llm);
    expect(getMinutes(id, "vi", { repos }).stale).toBe(false);

    repos.notes.remove(id, note.id);
    expect(getMinutes(id, "vi", { repos }).staleReasons).toEqual(["notes_changed"]);
  });

  it("flags an older prompt version and a changed model", async () => {
    const { id } = await fresh();
    const stored = repos.minutes.get(id, "vi");
    repos.minutes.upsert({
      meetingId: id,
      lang: "vi",
      content: stored!.content,
      source: "ai",
      model: "old-model",
      promptVersion: "1",
      marksFingerprint: stored!.marksFingerprint,
    });
    const dto = getMinutes(id, "vi", { repos, currentModel: () => "new-model" });
    expect(dto.staleReasons).toEqual(["prompt_updated", "model_changed"]);
    expect(dto.stale).toBe(true);
  });

  it("never flags rows written before versioning (NULL fields)", async () => {
    const id = endedMeeting();
    repos.minutes.upsert({
      meetingId: id,
      lang: "vi",
      content: { summary: "x", topics: [], actionItems: [], openIssues: [] },
      source: "ai",
    });
    const dto = getMinutes(id, "vi", { repos, currentModel: () => "whatever" });
    expect(dto).toMatchObject({ stale: false, staleReasons: [] });
  });
});
