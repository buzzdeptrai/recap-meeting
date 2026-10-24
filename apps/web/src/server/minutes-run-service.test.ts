import { IN_MEMORY, createRepositories, openDatabase, type Repositories } from "@recap/db";
import { FakeMinutesLlm, PROMPT_VERSION, UNCLAIMED_RUN_ERROR } from "@recap/minutes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMinutes } from "./minutes-service";
import {
  STALE_RUN_ERROR,
  getLatestRun,
  startMinutesRun,
  type MinutesRunDeps,
} from "./minutes-run-service";
import { testWorker } from "./minutes-test-support";

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
      text: "Nội dung",
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

const deps = (extra: Partial<MinutesRunDeps> = {}): MinutesRunDeps => ({
  repos,
  requireModel: () => "model-x",
  now,
  ...extra,
});

describe("startMinutesRun (enqueue only)", () => {
  it("creates a queued run with the same DTO shape and never runs the model", () => {
    const id = endedMeeting();
    const run = startMinutesRun(id, "vi", deps());
    expect(run).toMatchObject({
      lang: "vi",
      status: "queued",
      phase: null,
      done: 0,
      total: 0,
      error: null,
      finishedAt: null,
    });
    expect(Object.keys(run).sort()).toEqual(
      [
        "runId",
        "lang",
        "status",
        "phase",
        "done",
        "total",
        "error",
        "startedAt",
        "finishedAt",
      ].sort(),
    );
    expect(repos.minutesRuns.get(run.runId)).toMatchObject({
      status: "queued",
      model: "model-x",
      promptVersion: PROMPT_VERSION,
    });
    expect(repos.minutes.get(id, "vi")).toBeUndefined();
  });

  it("is idempotent while queued or running, and creates a new run once it finished", () => {
    const id = endedMeeting();
    const a = startMinutesRun(id, "vi", deps());
    expect(startMinutesRun(id, "vi", deps()).runId).toBe(a.runId);
    repos.minutesRuns.markRunning(a.runId);
    expect(startMinutesRun(id, "vi", deps()).runId).toBe(a.runId);
    expect(startMinutesRun(id, "en", deps()).runId).not.toBe(a.runId);
    repos.minutesRuns.finish(a.runId);
    expect(startMinutesRun(id, "vi", deps()).runId).not.toBe(a.runId);
  });

  it("rejects synchronously (404 / 409 / 422 / 503) without creating a run", () => {
    expect(() => startMinutesRun("nope", "vi", deps())).toThrow(
      expect.objectContaining({ status: 404 }),
    );
    const draft = repos.meetings.create({ title: "d" }).id;
    expect(() => startMinutesRun(draft, "vi", deps())).toThrow(
      expect.objectContaining({ status: 409, code: "MEETING_NOT_ENDED" }),
    );
    expect(() => startMinutesRun(endedMeeting(0), "vi", deps())).toThrow(
      expect.objectContaining({ status: 422 }),
    );
    const noKey = deps({
      requireModel: () => {
        throw Object.assign(new Error("x"), { status: 503, code: "MINUTES_UNAVAILABLE" });
      },
    });
    expect(() => startMinutesRun(endedMeeting(), "vi", noKey)).toThrow(
      expect.objectContaining({ status: 503 }),
    );
    expect(repos.minutesRuns.listActive()).toEqual([]);
  });

  it("is picked up by a worker and the progress is readable through getLatestRun", async () => {
    const id = endedMeeting();
    const run = startMinutesRun(id, "vi", deps());
    const worker = testWorker(repos, () => new FakeMinutesLlm(reply));
    worker.tick();
    expect(getLatestRun(id, "vi", deps())).toMatchObject({ runId: run.runId, status: "running" });
    await worker.whenIdle();
    expect(getLatestRun(id, "vi", deps())).toMatchObject({ status: "done", error: null });
    expect(getMinutes(id, "vi", { repos }).stale).toBe(false);
  });
});

describe("stale and unclaimed runs", () => {
  const TIMEOUT_MS = 10 * 60_000;
  const CLAIM_MS = 120_000;

  function orphanRunning() {
    const id = endedMeeting();
    const { run } = repos.minutesRuns.start({ meetingId: id, lang: "vi" });
    repos.minutesRuns.markRunning(run.id);
    return { id, runId: run.id };
  }

  it("fails an abandoned running row lazily when read, repeatably", () => {
    const { id, runId } = orphanRunning();
    const d = deps({ staleRunMs: TIMEOUT_MS });
    clockMs += TIMEOUT_MS - 1_000;
    expect(getLatestRun(id, "vi", d)?.status).toBe("running");
    clockMs += 2_000;
    expect(getLatestRun(id, "vi", d)).toMatchObject({
      runId,
      status: "failed",
      error: STALE_RUN_ERROR,
    });
    const once = repos.minutesRuns.get(runId);
    expect(getLatestRun(id, "vi", d)?.status).toBe("failed");
    expect(repos.minutesRuns.get(runId)).toEqual(once);
  });

  it("fails a queued run nobody claimed within the claim timeout, with the safe message", () => {
    const id = endedMeeting();
    const run = startMinutesRun(id, "vi", deps({ queuedClaimTimeoutMs: CLAIM_MS }));
    const d = deps({ queuedClaimTimeoutMs: CLAIM_MS });
    clockMs += CLAIM_MS - 1_000;
    expect(getLatestRun(id, "vi", d)?.status).toBe("queued");
    clockMs += 2_000;
    expect(getLatestRun(id, "vi", d)).toMatchObject({
      runId: run.runId,
      status: "failed",
      error: UNCLAIMED_RUN_ERROR,
    });
    expect(UNCLAIMED_RUN_ERROR).toBe("Dịch vụ xử lý nền chưa chạy. Hãy thử lại sau.");
    const once = repos.minutesRuns.get(run.runId);
    expect(getLatestRun(id, "vi", d)?.status).toBe("failed");
    expect(repos.minutesRuns.get(run.runId)).toEqual(once);
  });

  it("a claimed (running) run is not affected by the claim timeout", () => {
    const { id } = orphanRunning();
    clockMs += CLAIM_MS * 2;
    expect(getLatestRun(id, "vi", deps({ queuedClaimTimeoutMs: CLAIM_MS }))?.status).toBe(
      "running",
    );
  });

  it("the claim timeout is env-overridable and defaults to 120 s", () => {
    vi.stubEnv("MINUTES_QUEUED_CLAIM_TIMEOUT_MS", "5000");
    const id = endedMeeting();
    startMinutesRun(id, "vi", deps());
    clockMs += 6_000;
    expect(getLatestRun(id, "vi", deps())?.status).toBe("failed");
    vi.unstubAllEnvs();
  });

  it("does not let an abandoned row block a new start", () => {
    const { id, runId } = orphanRunning();
    clockMs += TIMEOUT_MS + 1_000;
    const run = startMinutesRun(id, "vi", deps({ staleRunMs: TIMEOUT_MS }));
    expect(run.runId).not.toBe(runId);
    expect(run.status).toBe("queued");
  });

  it("returns undefined when a meeting has no run, 404 for an unknown meeting", () => {
    expect(getLatestRun(endedMeeting(), "vi", deps())).toBeUndefined();
    expect(() => getLatestRun("nope", "vi", deps())).toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });
});
