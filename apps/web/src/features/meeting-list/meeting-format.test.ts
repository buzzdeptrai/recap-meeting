import { describe, expect, it } from "vitest";
import type { MeetingListItemDto } from "@/lib/api-types";
import { MINUTES_STALE_STATUS } from "@/lib/status";
import {
  durationLabel,
  exportAvailability,
  exportHref,
  formatTotalDuration,
  minutesAction,
  minutesChips,
  subLine,
  wallClockRange,
} from "./meeting-format";

const meeting = (over: Partial<MeetingListItemDto> = {}): MeetingListItemDto => ({
  id: "m1",
  title: "T",
  status: "ended",
  sourceLang: "vi",
  targetLang: "en",
  agenda: null,
  createdAt: "2026-10-22T05:00:00.000Z",
  startedAt: "2026-10-22T05:00:00.000Z",
  endedAt: "2026-10-22T05:02:06.000Z",
  durationMs: 126_000,
  minutesLangs: [],
  minutes: {},
  topicCount: 0,
  conclusionCount: 0,
  wordCount: 0,
  ...over,
});

describe("meeting-format", () => {
  it("formats durations", () => {
    expect(durationLabel(meeting())).toBe("00:02:06");
    expect(durationLabel(meeting({ durationMs: null }))).toBe("—");
    expect(formatTotalDuration(3_725_000)).toBe("1:02");
    expect(formatTotalDuration(0)).toBe("0:00");
  });

  it("shows the wall clock range in Vietnam time", () => {
    expect(wallClockRange(meeting())).toBe("12:00 – 12:02");
    expect(wallClockRange(meeting({ endedAt: null }))).toBe("từ 12:00");
    expect(wallClockRange(meeting({ startedAt: null }))).toBeNull();
  });

  it("picks the second line: snippet > agenda > first conclusion", () => {
    const all = meeting({
      snippet: "a <mark>b</mark>",
      agendaPreview: "Agenda",
      firstConclusion: "KL",
    });
    expect(subLine(all)?.kind).toBe("snippet");
    expect(subLine({ ...all, snippet: undefined })).toEqual({ kind: "agenda", text: "Agenda" });
    expect(subLine({ ...all, snippet: undefined, agendaPreview: undefined })).toEqual({
      kind: "conclusion",
      text: "KL",
    });
    expect(subLine(meeting())).toBeNull();
  });

  it("maps minutes state onto the single status mapping, stale first", () => {
    const chips = minutesChips(
      meeting({
        minutes: { vi: { source: "ai", stale: true }, en: { source: "edited", stale: false } },
      }),
    );
    expect(chips.map((c) => [c.lang, c.spec.label])).toEqual([
      ["vi", MINUTES_STALE_STATUS.label],
      ["en", "Đã chỉnh sửa"],
    ]);
    expect(chips[0]?.spec.tone).toBe("warn");
    expect(
      minutesChips(meeting({ minutes: { vi: { source: "ai", stale: false } } }))[0]?.spec,
    ).toEqual({
      label: "AI tạo",
      tone: "purple",
    });
  });

  it("decides export availability and the minutes action", () => {
    expect(exportAvailability(meeting())).toEqual({ vi: false, en: false, both: false });
    const both = meeting({
      minutes: { vi: { source: "ai", stale: false }, en: { source: "ai", stale: false } },
    });
    expect(exportAvailability(both)).toEqual({ vi: true, en: true, both: true });
    expect(minutesAction(both)).toBe("open");
    expect(minutesAction(meeting())).toBe("create");
    expect(minutesAction(meeting({ status: "live" }))).toBe("unavailable");
    expect(exportHref("a b", "both")).toBe("/api/meetings/a%20b/export?lang=both");
  });
});
