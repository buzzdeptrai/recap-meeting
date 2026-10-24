import {
  BorderStyle,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  WidthType,
  type TextRun,
} from "docx";
import type { MinutesLang, MinutesTopic, TopicStatus } from "@recap/core";
import { formatOffset } from "./format";
import { LABELS } from "./labels";
import { COLOR, CONTENT_WIDTH, SIZE, run } from "./theme";

const STATUS_COLOR: Record<TopicStatus, string> = {
  decided: COLOR.accent,
  open: COLOR.muted,
  rejected: COLOR.muted,
};

const stamp = (atMs: number | null): TextRun[] =>
  atMs === null ? [] : [run(`  [${formatOffset(atMs)}]`, { color: COLOR.muted, size: SIZE.small })];

export function buildTopicHeading(topic: MinutesTopic, lang: MinutesLang): Paragraph {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 240, after: 80 },
    children: [
      run(topic.title, { size: SIZE.h3, bold: true }),
      run(`   ${LABELS[lang].status[topic.status].toUpperCase()}`, {
        size: SIZE.label,
        bold: true,
        color: STATUS_COLOR[topic.status],
      }),
    ],
  });
}

export function buildKeyPoint(text: string, atMs: number | null): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60, line: 290 },
    children: [run(text), ...stamp(atMs)],
  });
}

const none = { style: BorderStyle.NONE, size: 0, color: "auto" };

/** A one-cell table renders the shaded call-out identically in Word, LibreOffice and previewers. */
export function buildConclusion(topic: MinutesTopic): Table | null {
  const c = topic.conclusion;
  if (!c) return null;
  const bar = { style: BorderStyle.SINGLE, size: 24, color: COLOR.calloutBorder };
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            borders: { top: none, bottom: none, right: none, left: bar },
            margins: { top: 100, bottom: 100, left: 180, right: 140 },
            shading: { type: ShadingType.CLEAR, fill: COLOR.calloutFill, color: "auto" },
            children: [
              new Paragraph({
                spacing: { line: 290 },
                children: [run(c.text, { bold: c.marked }), ...stamp(c.atMs)],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

const spacer = () => new Paragraph({ spacing: { after: 60 }, children: [] });

export function buildTopic(topic: MinutesTopic, lang: MinutesLang): (Paragraph | Table)[] {
  const conclusion = buildConclusion(topic);
  return [
    buildTopicHeading(topic, lang),
    ...topic.keyPoints.map((p) => buildKeyPoint(p.text, p.atMs)),
    ...(conclusion ? [spacer(), conclusion] : []),
  ];
}
