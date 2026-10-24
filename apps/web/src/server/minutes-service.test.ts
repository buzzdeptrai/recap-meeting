import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { FakeMinutesLlm } from "@recap/minutes";
import { beforeEach, describe, expect, it } from "vitest";
import { generateAndStoreMinutes, getMinutes, saveEditedMinutes } from "./minutes-service";
import { ServiceError } from "./service-error";

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

describe("generateAndStoreMinutes", () => {
  it("generates, stores as ai and returns the dto", async () => {
    const id = endedMeeting();
    const llm = new FakeMinutesLlm(reply);
    const dto = await generateAndStoreMinutes(id, "vi", { repos, llm: () => llm });
    expect(dto).toMatchObject({ lang: "vi", source: "ai" });
    expect(dto.content.topics[0]?.conclusion).toMatchObject({ atMs: 5_000, marked: true });
    expect(repos.minutes.get(id, "vi")?.model).toBe("fake-model");
    expect(getMinutes(id, "vi", { repos })).toEqual(dto);
  });

  it("regenerating replaces edited minutes", async () => {
    const id = endedMeeting();
    const deps = { repos, llm: () => new FakeMinutesLlm(reply) };
    const first = await generateAndStoreMinutes(id, "vi", deps);
    saveEditedMinutes(id, "vi", { ...first.content, summary: "Sửa tay" }, { repos });
    const again = await generateAndStoreMinutes(id, "vi", deps);
    expect(again).toMatchObject({ source: "ai" });
    expect(again.content.summary).toBe("Chốt giá.");
  });

  it("404 for unknown meeting, 409 unless ended, 422 when there is no transcript", async () => {
    const llm = () => new FakeMinutesLlm(reply);
    await expect(generateAndStoreMinutes("nope", "vi", { repos, llm })).rejects.toMatchObject({
      status: 404,
    });
    const draft = repos.meetings.create({ title: "d" }).id;
    await expect(generateAndStoreMinutes(draft, "vi", { repos, llm })).rejects.toMatchObject({
      status: 409,
      code: "MEETING_NOT_ENDED",
    });
    const live = repos.meetings.create({ title: "l" }).id;
    repos.meetings.start(live);
    await expect(generateAndStoreMinutes(live, "vi", { repos, llm })).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      generateAndStoreMinutes(endedMeeting(false), "vi", { repos, llm }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("maps model failures to 502 and a missing key to 503, storing nothing", async () => {
    const id = endedMeeting();
    const bad = { repos, llm: () => new FakeMinutesLlm("garbage") };
    await expect(generateAndStoreMinutes(id, "vi", bad)).rejects.toMatchObject({
      status: 502,
      code: "MINUTES_FAILED",
    });
    const noKey = {
      repos,
      llm: () => {
        throw new ServiceError(503, "MINUTES_UNAVAILABLE", "x");
      },
    };
    await expect(generateAndStoreMinutes(id, "en", noKey)).rejects.toMatchObject({ status: 503 });
    expect(repos.minutes.get(id, "vi")).toBeUndefined();
  });

  it("shares one run between concurrent identical requests", async () => {
    const id = endedMeeting();
    const llm = new FakeMinutesLlm(reply);
    const deps = { repos, llm: () => llm };
    const [a, b] = await Promise.all([
      generateAndStoreMinutes(id, "vi", deps),
      generateAndStoreMinutes(id, "vi", deps),
    ]);
    expect(a).toEqual(b);
    expect(llm.calls).toHaveLength(1);
  });
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
    const deps = { repos, llm: () => new FakeMinutesLlm(reply) };
    const vi = await generateAndStoreMinutes(id, "vi", deps);
    await generateAndStoreMinutes(id, "en", deps);
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
    const deps = { repos: timed, llm: () => new FakeMinutesLlm(reply) };
    const dto = await generateAndStoreMinutes(meeting.id, "vi", deps);
    return { timed, id: meeting.id, deps, dto };
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
    expect((await generateAndStoreMinutes(id, "vi", deps)).stale).toBe(false);
  });

  it("becomes stale when a topic marker is added or renamed, and stays stale after a user edit", async () => {
    const { timed, id, deps, dto } = await generated();
    const mark = timed.marks.insert({ meetingId: id, kind: "topic", atMs: 1_000 });
    expect(getMinutes(id, "vi", deps).stale).toBe(true);
    expect(saveEditedMinutes(id, "vi", dto.content, deps).stale).toBe(true);
    await generateAndStoreMinutes(id, "vi", deps);
    expect(getMinutes(id, "vi", deps).stale).toBe(false);
    timed.marks.updateLabel(id, mark.id, "Chủ đề mới");
    expect(getMinutes(id, "vi", deps).stale).toBe(true);
  });
});
