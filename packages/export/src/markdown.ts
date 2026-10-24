import type { ActionItem, MinutesContent, MinutesLang, MinutesTopic } from "@recap/core";
import { ExportError, languagesFor } from "./document";
import { formatDateTime, formatDuration, formatOffset } from "./format";
import { LABELS } from "./labels";
import type { BuildMinutesDocxInput, ExportMeeting } from "./types";

const EMPTY_CELL = "—";
const LANGUAGE_SEPARATOR = "\n\n---\n\n";

const stamp = (atMs: number | null): string =>
  atMs === null ? "" : ` \`[${formatOffset(atMs)}]\``;

const cell = (text: string): string => text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

function titleBlock(meeting: ExportMeeting, lang: MinutesLang): string[] {
  const l = LABELS[lang];
  return [
    `# ${meeting.title}`,
    `*${l.minutes}*`,
    `- **${l.date}:** ${formatDateTime(meeting.startedAt, lang)}\n` +
      `- **${l.duration}:** ${formatDuration(meeting.durationMs, lang)}`,
  ];
}

function topicBlocks(topic: MinutesTopic, lang: MinutesLang): string[] {
  const blocks = [`### ${topic.title}`, `*${LABELS[lang].status[topic.status]}*`];
  if (topic.keyPoints.length > 0) {
    blocks.push(topic.keyPoints.map((p) => `- ${p.text}${stamp(p.atMs)}`).join("\n"));
  }
  const c = topic.conclusion;
  if (c) blocks.push(`> ${c.marked ? `**${c.text}**` : c.text}${stamp(c.atMs)}`);
  return blocks;
}

function actionRow(item: ActionItem): string {
  const task = `${cell(item.task)}${stamp(item.atMs)}`;
  return `| ${task} | ${cell(item.owner ?? EMPTY_CELL)} | ${cell(item.due ?? EMPTY_CELL)} |`;
}

function actionBlocks(items: ActionItem[], lang: MinutesLang): string[] {
  const l = LABELS[lang];
  const heading = `## ${l.actionItems}`;
  if (items.length === 0) return [heading, l.noActions];
  const head = `| ${l.task} | ${l.owner} | ${l.due} |\n| --- | --- | --- |`;
  return [heading, `${head}\n${items.map(actionRow).join("\n")}`];
}

function languageSection(
  meeting: ExportMeeting,
  content: MinutesContent,
  lang: MinutesLang,
): string {
  const l = LABELS[lang];
  const blocks = [...titleBlock(meeting, lang), `## ${l.summary}`, content.summary];
  if (content.topics.length > 0) {
    blocks.push(`## ${l.topics}`);
    for (const topic of content.topics) blocks.push(...topicBlocks(topic, lang));
  }
  blocks.push(...actionBlocks(content.actionItems, lang));
  if (content.openIssues.length > 0) {
    blocks.push(`## ${l.openIssues}`, content.openIssues.map((i) => `- ${i.text}`).join("\n"));
  }
  return blocks.join("\n\n");
}

/** Markdown twin of buildMinutesDocx; `both` = Vietnamese, a horizontal rule, then English. */
export function exportMinutesMarkdown(input: BuildMinutesDocxInput): string {
  const sections = languagesFor(input.mode).map((lang) => {
    const content = input.minutes[lang];
    if (!content)
      throw new ExportError("MISSING_MINUTES", `Missing minutes for language "${lang}".`);
    return languageSection(input.meeting, content, lang);
  });
  return `${sections.join(LANGUAGE_SEPARATOR)}\n`;
}
