import { BorderStyle, Paragraph, ShadingType } from "docx";
import type { MinutesLang, MinutesTopic, TopicStatus } from "@recap/core";
import { formatOffset } from "./format";
import { LABELS } from "./labels";
import { COLOR, SIZE, run } from "./theme";

const STATUS_COLOR: Record<TopicStatus, string> = {
  decided: COLOR.accent,
  open: COLOR.muted,
  rejected: COLOR.muted,
};

export function buildTopicHeading(topic: MinutesTopic, lang: MinutesLang): Paragraph {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 240, after: 80 },
    children: [
      run(topic.title, { size: 24, bold: true }),
      run(`   ${LABELS[lang].status[topic.status].toUpperCase()}`, {
        size: SIZE.label,
        bold: true,
        color: STATUS_COLOR[topic.status],
      }),
    ],
  });
}

export function buildKeyPoint(text: string, atMs: number | null): Paragraph {
  const children = [run(text)];
  if (atMs !== null)
    children.push(run(`  [${formatOffset(atMs)}]`, { color: COLOR.muted, size: SIZE.small }));
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 60, line: 290 }, children });
}

export function buildConclusion(topic: MinutesTopic): Paragraph | null {
  const c = topic.conclusion;
  if (!c) return null;
  const bar = { style: BorderStyle.SINGLE, size: 24, color: COLOR.calloutBorder, space: 8 };
  const children = [run(c.text, { bold: c.marked })];
  if (c.atMs !== null)
    children.push(run(`  [${formatOffset(c.atMs)}]`, { color: COLOR.muted, size: SIZE.small }));
  return new Paragraph({
    spacing: { before: 100, after: 140, line: 290 },
    indent: { left: 200, right: 100 },
    border: { left: bar },
    shading: { type: ShadingType.CLEAR, fill: COLOR.calloutFill, color: "auto" },
    children,
  });
}

export function buildTopic(topic: MinutesTopic, lang: MinutesLang): Paragraph[] {
  const conclusion = buildConclusion(topic);
  return [
    buildTopicHeading(topic, lang),
    ...topic.keyPoints.map((p) => buildKeyPoint(p.text, p.atMs)),
    ...(conclusion ? [conclusion] : []),
  ];
}
