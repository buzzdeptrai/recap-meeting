import type { Paragraph, Table } from "docx";
import type { MinutesContent, MinutesLang } from "@recap/core";
import { LABELS } from "./labels";
import { buildActionSection, buildOpenIssues } from "./tables";
import { buildSectionHeading, buildSummary, buildTitleBlock } from "./title-block";
import { buildTopic } from "./topics";
import type { ExportMeeting } from "./types";

export type Block = Paragraph | Table;

/** One full-language body: title block, summary, topics, action items, open issues. */
export function buildLanguageSection(
  meeting: ExportMeeting,
  content: MinutesContent,
  lang: MinutesLang,
): Block[] {
  const blocks: Block[] = [
    ...buildTitleBlock(meeting, lang),
    ...buildSummary(content.summary, lang),
  ];
  if (content.topics.length > 0) {
    blocks.push(buildSectionHeading(LABELS[lang].topics));
    for (const topic of content.topics) blocks.push(...buildTopic(topic, lang));
  }
  blocks.push(
    ...buildActionSection(content.actionItems, lang),
    ...buildOpenIssues(content.openIssues, lang),
  );
  return blocks;
}
