import { Paragraph, TextRun, type IRunOptions } from "docx";

/** Calibri renders Vietnamese diacritics; eastAsia/cs are set so Word never falls back oddly. */
export const FONT = { ascii: "Calibri", hAnsi: "Calibri", eastAsia: "Calibri", cs: "Calibri" };

export const COLOR = {
  text: "2B2F36", // graphite
  muted: "6B7280",
  accent: "1F5FA8", // the one blue
  rule: "D5D9E0",
  headerFill: "EEF2F7",
  calloutFill: "FFF4D6", // amber, conclusions only
  calloutBorder: "E0A100",
} as const;

/** docx sizes are half-points. */
export const SIZE = { body: 21, small: 18, h1: 40, h2: 26, h3: 24, label: 17 } as const;

/** A4 in twips with 2 cm side margins. */
export const PAGE = {
  width: 11906,
  height: 16838,
  margin: { top: 1500, bottom: 1200, left: 1134, right: 1134, header: 600, footer: 500 },
} as const;
export const CONTENT_WIDTH = PAGE.width - PAGE.margin.left - PAGE.margin.right;

export const run = (text: string, opts: Omit<IRunOptions, "text" | "children"> = {}) =>
  new TextRun({ text, font: FONT, size: SIZE.body, color: COLOR.text, ...opts });

export const plain = (text: string, after = 120) =>
  new Paragraph({ spacing: { after, line: 300 }, children: [run(text)] });
