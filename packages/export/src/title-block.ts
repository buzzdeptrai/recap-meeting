import { BorderStyle, Paragraph } from "docx";
import type { MinutesLang } from "@recap/core";
import { formatDateTime, formatDuration } from "./format";
import { LABELS } from "./labels";
import { COLOR, SIZE, plain, run } from "./theme";
import type { ExportMeeting } from "./types";

const metaLine = (label: string, value: string, last = false) =>
  new Paragraph({
    spacing: { after: last ? 200 : 40 },
    border: last
      ? { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR.accent, space: 8 } }
      : undefined,
    children: [
      run(`${label}: `, { color: COLOR.muted, size: SIZE.small }),
      run(value, { size: SIZE.small }),
    ],
  });

export function buildTitleBlock(meeting: ExportMeeting, lang: MinutesLang): Paragraph[] {
  const l = LABELS[lang];
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
    metaLine(l.date, formatDateTime(meeting.startedAt, lang)),
    metaLine(l.duration, formatDuration(meeting.durationMs, lang), true),
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
