import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  TabStopType,
} from "docx";
import type { MinutesLang } from "@recap/core";
import { buildLanguageSection, type Block } from "./language-section";
import { LABELS } from "./labels";
import { COLOR, CONTENT_WIDTH, FONT, PAGE, SIZE, run } from "./theme";
import type { BuildMinutesDocxInput, ExportMeeting } from "./types";

export class ExportError extends Error {
  constructor(
    readonly code: "MISSING_MINUTES",
    message: string,
  ) {
    super(message);
    this.name = "ExportError";
  }
}

export function languagesFor(mode: BuildMinutesDocxInput["mode"]): MinutesLang[] {
  return mode === "both" ? ["vi", "en"] : [mode];
}

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
  const small = { size: SIZE.label, color: COLOR.muted };
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
        children: [
          run(`${l.page} `, small),
          run("", { ...small, children: [PageNumber.CURRENT] }),
          run(` ${l.of} `, small),
          run("", { ...small, children: [PageNumber.TOTAL_PAGES] }),
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
    if (!content) {
      throw new ExportError("MISSING_MINUTES", `Missing minutes for language "${lang}".`);
    }
    return section(input.meeting, lang, buildLanguageSection(input.meeting, content, lang));
  });
  const doc = new Document({
    creator: "Recap Meeting",
    title: input.meeting.title,
    styles: { default: { document: { run: { font: FONT, size: SIZE.body, color: COLOR.text } } } },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT },
          ],
        },
      ],
    },
    sections,
  });
  return Packer.toBuffer(doc);
}
