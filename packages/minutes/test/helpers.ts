import { IN_MEMORY, createRepositories, openDatabase } from "@recap/db";

export interface SeedSegment {
  channel?: 0 | 1;
  lang?: string | null;
  startMs: number;
  endMs?: number;
  text: string;
  translation?: { lang: "vi" | "en"; text: string };
}

/** In-memory DB with one meeting plus segments / marks. Returns the repos and ids. */
export function seed(options: {
  segments: SeedSegment[];
  marks?: number[];
  topics?: { atMs: number; label?: string }[];
  agenda?: string | null;
  title?: string;
}) {
  const repos = createRepositories(openDatabase(IN_MEMORY));
  const meeting = repos.meetings.create({
    title: options.title ?? "Họp đối tác",
    agenda: options.agenda ?? null,
  });
  options.segments.forEach((s, seq) => {
    const stored = repos.segments.insert({
      meetingId: meeting.id,
      seq,
      channel: s.channel ?? 1,
      lang: s.lang === undefined ? "vi" : s.lang,
      startMs: s.startMs,
      endMs: s.endMs ?? s.startMs + 2_000,
      text: s.text,
    });
    if (s.translation) {
      repos.translations.upsert({
        segmentId: stored.id,
        lang: s.translation.lang,
        text: s.translation.text,
        provider: "fake",
        latencyMs: 1,
      });
    }
  });
  for (const atMs of options.marks ?? []) {
    repos.marks.insert({ meetingId: meeting.id, kind: "conclusion", atMs });
  }
  for (const topic of options.topics ?? []) {
    repos.marks.insert({ meetingId: meeting.id, kind: "topic", ...topic });
  }
  return { repos, meetingId: meeting.id };
}

/** Counter-based id factory so tests can assert uuids are app-made. */
export function counterIds(prefix = "id") {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

export const emptyReply = { summary: "Tóm tắt.", topics: [], actionItems: [], openIssues: [] };
