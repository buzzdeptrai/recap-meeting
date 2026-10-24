import { BorderStyle, Paragraph } from "docx";
import type { MinutesLang } from "@recap/core";
import { formatDateTime, formatDuration } from "./format";
import { LABELS } from "./labels";
import { COLOR, SIZE, plain, run } from "./theme";
import type { ExportMeeting } from "./types";

export function buildTitleBlock(meeting: ExportMeeting, lang: MinutesLang): Paragraph[] {
  const l = LABELS[lang];
  const meta = (label: string, value: string) =>
    new Paragraph({
      spacing: { after: 40 },
      children: [
        run(`${label}: `, { color: COLOR.muted, size: SIZE.small }),
        run(value, { size: SIZE.small }),
      ],
    });
  return [
    new Paragraph({
      spacing: { after: 60 },
      children: [
        run(l.minutes.toUpperCase(), {
          size: SIZE.label,
          bold: true,
          color: COLOR.accent,
          characterSpacing: 40,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [run(meeting.title, { size: SIZE.h1, bold: true })],
    }),
    meta(l.date, formatDateTime(meeting.startedAt, lang)),
    new Paragraph({
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR.accent, space: 8 } },
      children: [
        run(`${l.duration}: `, { color: COLOR.muted, size: SIZE.small }),
        run(formatDuration(meeting.durationMs, lang), { size: SIZE.small }),
      ],
    }),
  ];
}

export function buildSectionHeading(text: string): Paragraph {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 280, after: 120 },
    children: [run(text, { size: SIZE.h2, bold: true, color: COLOR.accent })],
  });
}

export function buildSummary(summary: string, lang: MinutesLang): Paragraph[] {
  return [buildSectionHeading(LABELS[lang].summary), plain(summary, 160)];
}
