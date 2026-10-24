import type { UsageEventInput } from "@recap/core";
import type { Repositories } from "@recap/db";
import { createMinutesWorker, type LlmFactory, type MinutesWorker } from "../src";

export const reply = {
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
export const GENERIC = "Không tạo được biên bản. Vui lòng thử lại.";
export const SMALL_CHUNKS = { singlePassMaxTokens: 100, chunkTokens: 250 };

export function endedMeeting(repos: Repositories, segmentCount = 1): string {
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

export function buildWorker(
  repos: Repositories,
  usage: UsageEventInput[],
  createLlm: LlmFactory,
  over: { repos?: Repositories; concurrency?: number; config?: object } = {},
): MinutesWorker {
  const r = over.repos ?? repos;
  return createMinutesWorker({
    runs: r.minutesRuns,
    minutes: r.minutes,
    repos: r,
    createLlm,
    usage: (event) => usage.push(event),
    generatorConfig: over.config,
    pollMs: 10,
    concurrency: over.concurrency ?? 1,
    log: () => {},
  });
}

export async function waitFor(condition: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 5));
  }
}
