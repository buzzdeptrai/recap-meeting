import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";
import type { MinutesLang } from "@recap/core";
import { LABELS } from "./labels";
import { buildLanguageSection, type Block } from "./language-section";
import { COLOR, FONT, PAGE, SIZE, run } from "./theme";
import type { BuildMinutesDocxInput, ExportMeeting, ExportMode } from "./types";

export class ExportError extends Error {
  constructor(
    readonly code: "MISSING_MINUTES",
    message: string,
  ) {
    super(message);
    this.name = "ExportError";
  }
}

export function languagesFor(mode: ExportMode): MinutesLang[] {
  return mode === "both" ? ["vi", "en"] : [mode];
}

const small = { font: FONT, size: SIZE.label, color: COLOR.muted };

function buildHeader(title: string): Header {
  return new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule, space: 4 } },
        children: [run(title, { size: SIZE.label, color: COLOR.muted })],
      }),
    ],
  });
}

function buildFooter(lang: MinutesLang): Footer {
  const l = LABELS[lang];
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ ...small, text: `${l.page} ` }),
          new TextRun({ ...small, children: [PageNumber.CURRENT] }),
          new TextRun({ ...small, text: ` ${l.of} ` }),
          new TextRun({ ...small, children: [PageNumber.TOTAL_PAGES] }),
        ],
      }),
    ],
  });
}

function section(meeting: ExportMeeting, lang: MinutesLang, children: Block[]) {
  return {
    properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: PAGE.margin } },
    headers: { default: buildHeader(meeting.title) },
    footers: { default: buildFooter(lang) },
    children,
  };
}

/** Builds a .docx. `both` = Vietnamese section, then English section starting on a new page. */
export async function buildMinutesDocx(input: BuildMinutesDocxInput): Promise<Buffer> {
  const sections = languagesFor(input.mode).map((lang) => {
    const content = input.minutes[lang];
    if (!content)
      throw new ExportError("MISSING_MINUTES", `Missing minutes for language "${lang}".`);
    return section(input.meeting, lang, buildLanguageSection(input.meeting, content, lang));
  });
  const doc = new Document({
    creator: "Recap Meeting",
    title: input.meeting.title,
    styles: { default: { document: { run: { font: FONT, size: SIZE.body, color: COLOR.text } } } },
    sections,
  });
  return Packer.toBuffer(doc);
}
