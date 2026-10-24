import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { FakeMinutesLlm, PROMPT_VERSION } from "@recap/minutes";
import { beforeEach, describe, expect, it } from "vitest";
import { getMinutes } from "./minutes-service";
import {
  STALE_RUN_ERROR,
  getLatestRun,
  startMinutesRun,
  whenRunSettled,
} from "./minutes-run-service";
import { usageContext } from "./usage-recorder";

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
let clockMs: number;
const now = () => clockMs;

function endedMeeting(segmentCount = 1) {
  const meeting = repos.meetings.create({ title: "Họp" });
  repos.meetings.start(meeting.id);
  repos.meetings.end(meeting.id);
  for (let seq = 0; seq < segmentCount; seq++) {
    repos.segments.insert({
      meetingId: meeting.id,
      seq,
      channel: 1,
      lang: "vi",
      startMs: seq * 60_000,
      endMs: seq * 60_000 + 2_000,
      text: `Nội dung phần ${seq} `.repeat(segmentCount > 1 ? 20 : 1),
    });
  }
  return meeting.id;
}

beforeEach(() => {
  clockMs = Date.parse("2026-10-24T08:00:00.000Z");
  repos = createRepositories(openDatabase(IN_MEMORY), {
    now: () => new Date(clockMs).toISOString(),
  });
});

const depsWith = (llm: () => FakeMinutesLlm, extra = {}) => ({ repos, llm, now, ...extra });

describe("startMinutesRun", () => {
  it("returns the run at once, finishes in the background and stores versioned minutes", async () => {
    const id = endedMeeting();
    const deps = depsWith(() => new FakeMinutesLlm(reply));
    const run = startMinutesRun(id, "vi", deps);
    expect(run).toMatchObject({ lang: "vi", status: "queued", done: 0, total: 0, error: null });
    expect(repos.minutes.get(id, "vi")).toBeUndefined();

    await whenRunSettled(run.runId);
    expect(getLatestRun(id, "vi", deps)).toMatchObject({
      runId: run.runId,
      status: "done",
      error: null,
    });
    expect(getLatestRun(id, "vi", deps)?.finishedAt).not.toBeNull();
    expect(repos.minutes.get(id, "vi")).toMatchObject({
      source: "ai",
      model: "fake-model",
      promptVersion: PROMPT_VERSION,
    });
    expect(getMinutes(id, "vi", { repos }).stale).toBe(false);
  });

  it("is idempotent: a second start while active returns the same run and calls the model once", async () => {
    const id = endedMeeting();
    const llm = new FakeMinutesLlm(reply);
    const deps = depsWith(() => llm);
    const a = startMinutesRun(id, "vi", deps);
    const b = startMinutesRun(id, "vi", deps);
    expect(b.runId).toBe(a.runId);
    await whenRunSettled(a.runId);
    expect(llm.calls).toHaveLength(1);
    // finished: a new start creates a new run
    const c = startMinutesRun(id, "vi", deps);
    expect(c.runId).not.toBe(a.runId);
    await whenRunSettled(c.runId);
  });

  it("rejects synchronously (404 / 409 / 422 / 503) without creating a run", () => {
    const deps = depsWith(() => new FakeMinutesLlm(reply));
    expect(() => startMinutesRun("nope", "vi", deps)).toThrow(
      expect.objectContaining({ status: 404 }),
    );
    const draft = repos.meetings.create({ title: "d" }).id;
    expect(() => startMinutesRun(draft, "vi", deps)).toThrow(
      expect.objectContaining({ status: 409, code: "MEETING_NOT_ENDED" }),
    );
    expect(() => startMinutesRun(endedMeeting(0), "vi", deps)).toThrow(
      expect.objectContaining({ status: 422 }),
    );
    const noKey = depsWith(() => {
      throw Object.assign(new Error("x"), { status: 503, code: "MINUTES_UNAVAILABLE" });
    });
    expect(() => startMinutesRun(endedMeeting(), "vi", noKey)).toThrow(
      expect.objectContaining({ status: 503 }),
    );
    expect(repos.minutesRuns.listActive()).toEqual([]);
  });

  it("marks the run failed with a safe message and never leaves it running", async () => {
    const id = endedMeeting();
    const llm = new FakeMinutesLlm(() => {
      throw new Error("sk-SECRET-KEY exploded: prompt was 'xin chao'");
    });
    const deps = depsWith(() => llm);
    const run = startMinutesRun(id, "vi", deps);
    await whenRunSettled(run.runId);
    const after = getLatestRun(id, "vi", deps);
    expect(after?.status).toBe("failed");
    expect(after?.error).toBeTruthy();
    expect(after?.error).not.toMatch(/sk-|SECRET|prompt|xin chao/);
    expect(repos.minutesRuns.listActive()).toEqual([]);
    expect(repos.minutes.get(id, "vi")).toBeUndefined();
  });

  it("maps invalid model output to the Vietnamese service message", async () => {
    const id = endedMeeting();
    const deps = depsWith(() => new FakeMinutesLlm("garbage"));
    const run = startMinutesRun(id, "vi", deps);
    await whenRunSettled(run.runId);
    expect(getLatestRun(id, "vi", deps)?.error).toBe(
      "Mô hình trả về kết quả không hợp lệ. Vui lòng thử lại.",
    );
  });

  it("writes chunk progress to the DB while a long meeting runs", async () => {
    const id = endedMeeting(12);
    const seen: Array<{ phase: string | null; done: number; total: number; status: string }> = [];
    const llm = new FakeMinutesLlm(() => {
      const run = repos.minutesRuns.latest(id, "vi");
      if (run)
        seen.push({
          phase: run.phase,
          done: run.doneChunks,
          total: run.totalChunks,
          status: run.status,
        });
      return reply;
    });
    const deps = depsWith(() => llm, { config: { singlePassMaxTokens: 100, chunkTokens: 250 } });
    const run = startMinutesRun(id, "vi", deps);
    await whenRunSettled(run.runId);

    const chunks = llm.calls.length - 1;
    expect(chunks).toBeGreaterThan(1);
    expect(seen.map((s) => s.done).slice(0, chunks)).toEqual(
      Array.from({ length: chunks }, (_, i) => i),
    );
    expect(seen.every((s) => s.status === "running" && s.total === chunks)).toBe(true);
    expect(seen.at(-1)?.phase).toBe("reduce");
    expect(getLatestRun(id, "vi", deps)).toMatchObject({ status: "done", total: chunks });
  });

  it("keeps the usage context (meeting id) inside the detached run, for metering", async () => {
    const id = endedMeeting();
    const contexts: Array<string | undefined> = [];
    const llm = new FakeMinutesLlm(() => {
      contexts.push(usageContext.getStore()?.meetingId);
      return reply;
    });
    const run = startMinutesRun(
      id,
      "vi",
      depsWith(() => llm),
    );
    await whenRunSettled(run.runId);
    expect(contexts).toEqual([id]);
  });
});

describe("stale runs", () => {
  const TIMEOUT_MS = 10 * 60_000;

  function orphanRun() {
    const id = endedMeeting();
    const { run } = repos.minutesRuns.start({ meetingId: id, lang: "vi" });
    repos.minutesRuns.markRunning(run.id);
    return { id, runId: run.id };
  }

  it("fails an abandoned running row lazily when read, repeatably", () => {
    const { id, runId } = orphanRun();
    const deps = depsWith(() => new FakeMinutesLlm(reply), { staleRunMs: TIMEOUT_MS });
    clockMs += TIMEOUT_MS - 1_000;
    expect(getLatestRun(id, "vi", deps)?.status).toBe("running");
    clockMs += 2_000;
    expect(getLatestRun(id, "vi", deps)).toMatchObject({
      runId,
      status: "failed",
      error: STALE_RUN_ERROR,
    });
    const once = repos.minutesRuns.get(runId);
    expect(getLatestRun(id, "vi", deps)?.status).toBe("failed");
    expect(repos.minutesRuns.get(runId)).toEqual(once);
  });

  it("does not let an abandoned row block a new start", async () => {
    const { id, runId } = orphanRun();
    const deps = depsWith(() => new FakeMinutesLlm(reply), { staleRunMs: TIMEOUT_MS });
    clockMs += TIMEOUT_MS + 1_000;
    const run = startMinutesRun(id, "vi", deps);
    expect(run.runId).not.toBe(runId);
    await whenRunSettled(run.runId);
    expect(getLatestRun(id, "vi", deps)?.status).toBe("done");
  });

  it("returns undefined when a meeting has no run", () => {
    expect(
      getLatestRun(
        endedMeeting(),
        "vi",
        depsWith(() => new FakeMinutesLlm(reply)),
      ),
    ).toBeUndefined();
  });

  it("404 for an unknown meeting", () => {
    expect(() =>
      getLatestRun(
        "nope",
        "vi",
        depsWith(() => new FakeMinutesLlm(reply)),
      ),
    ).toThrow(expect.objectContaining({ status: 404 }));
  });
});
