import { IN_MEMORY, createRepositories, createUsageRecorder, openDatabase } from "@recap/db";
import { RESTART_RUN_ERROR, type OpenAiClientLike } from "@recap/minutes";
import { afterEach, describe, expect, it } from "vitest";
import { createRealtimeMinutesWorker } from "../src/minutes-worker";
import { createHarness, type Harness } from "./helpers";

const SECRET = "sk-test-secret-never-logged";
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

function fakeClient(): OpenAiClientLike & { calls: number } {
  const client = {
    calls: 0,
    chat: {
      completions: {
        create: async () => {
          client.calls += 1;
          return {
            choices: [{ message: { content: JSON.stringify(reply) } }],
            usage: { prompt_tokens: 100, completion_tokens: 20 },
          };
        },
      },
    },
  };
  return client;
}

function setup() {
  const db = openDatabase(IN_MEMORY);
  const repos = createRepositories(db);
  const meeting = repos.meetings.create({ title: "Họp" });
  repos.meetings.start(meeting.id);
  repos.meetings.end(meeting.id);
  repos.segments.insert({
    meetingId: meeting.id,
    seq: 0,
    channel: 1,
    lang: "vi",
    startMs: 1_000,
    endMs: 3_000,
    text: "Chốt 95 triệu",
  });
  const usageRows = () => db.prepare("SELECT COUNT(*) FROM usage_events").pluck().get() as number;
  const usage = createUsageRecorder(repos.usage, { version: 1, currency: "USD", entries: [] });
  return { db, repos, meetingId: meeting.id, usage, usageRows };
}

describe("realtime minutes worker wiring", () => {
  it("runs a queued run through the DB repositories and records usage_events once per call", async () => {
    const { repos, meetingId, usage, usageRows } = setup();
    const client = fakeClient();
    const { run } = repos.minutesRuns.start({ meetingId, lang: "vi" });
    const worker = createRealtimeMinutesWorker({
      repos,
      usage,
      source: { OPENAI_API_KEY: SECRET, OPENAI_MINUTES_MODEL: "model-from-env" },
      client,
      log: () => {},
    });
    worker.tick();
    await worker.whenIdle();

    expect(repos.minutesRuns.get(run.id)?.status).toBe("done");
    expect(repos.minutes.get(meetingId, "vi")).toMatchObject({ model: "model-from-env" });
    expect(client.calls).toBe(1);
    expect(usageRows()).toBe(client.calls);
  });

  it("reads poll / concurrency from env and exposes them in status", () => {
    const { repos, usage } = setup();
    const worker = createRealtimeMinutesWorker({
      repos,
      usage,
      source: { MINUTES_WORKER_POLL_MS: "250", MINUTES_WORKER_CONCURRENCY: "2" },
      log: () => {},
    });
    expect(worker.status()).toMatchObject({ running: false, pollMs: 250 });
  });

  it("fails the run with the config message and leaks no key when the key is missing", async () => {
    const { repos, meetingId, usage } = setup();
    const { run } = repos.minutesRuns.start({ meetingId, lang: "vi" });
    const logs: string[] = [];
    const worker = createRealtimeMinutesWorker({
      repos,
      usage,
      source: { OPENAI_API_KEY: "" },
      log: (line) => logs.push(line),
    });
    worker.tick();
    await worker.whenIdle();
    expect(repos.minutesRuns.get(run.id)).toMatchObject({
      status: "failed",
      error: "Chưa cấu hình dịch vụ tạo biên bản.",
    });
    expect(logs.join("\n")).not.toContain(SECRET);
  });

  it("start() logs 'minutes worker started' (no secrets) and recovers dead runs", async () => {
    const { repos, meetingId, usage } = setup();
    const { run } = repos.minutesRuns.start({ meetingId, lang: "vi" });
    repos.minutesRuns.markRunning(run.id);
    const logs: string[] = [];
    const worker = createRealtimeMinutesWorker({
      repos,
      usage,
      source: { OPENAI_API_KEY: SECRET },
      log: (line) => logs.push(line),
    });
    worker.start();
    await worker.stop();
    expect(logs.some((line) => line.includes("minutes worker started"))).toBe(true);
    expect(logs.join("\n")).not.toContain(SECRET);
    expect(repos.minutesRuns.get(run.id)).toMatchObject({
      status: "failed",
      error: RESTART_RUN_ERROR,
    });
  });
});

describe("GET /health", () => {
  let harness: Harness | undefined;
  afterEach(async () => harness?.close());

  it("adds minutesWorker {running, pollMs} when a worker is wired, nothing else leaks", async () => {
    const { repos, usage } = setup();
    const worker = createRealtimeMinutesWorker({
      repos,
      usage,
      source: { OPENAI_API_KEY: SECRET, MINUTES_WORKER_POLL_MS: "250" },
      log: () => {},
    });
    harness = await createHarness({ minutesWorker: worker });
    worker.start();
    const body = await (await fetch(`http://localhost:${harness.port}/health`)).json();
    await worker.stop();
    expect(body).toEqual({ ok: true, minutesWorker: { running: true, pollMs: 250 } });
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("stays {ok:true} without a worker", async () => {
    harness = await createHarness();
    const body = await (await fetch(`http://localhost:${harness.port}/health`)).json();
    expect(body).toEqual({ ok: true });
  });
});
