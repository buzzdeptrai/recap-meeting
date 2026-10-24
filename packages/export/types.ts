import type { MinutesContent, MinutesLang } from "@recap/core";

export interface ExportMeeting {
  title: string;
  startedAt: string | null;
  durationMs: number | null;
}

export type ExportMode = MinutesLang | "both";

export interface BuildMinutesDocxInput {
  meeting: ExportMeeting;
  minutes: Partial<Record<MinutesLang, MinutesContent>>;
  mode: ExportMode;
}
