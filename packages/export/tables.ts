import { BorderStyle, Paragraph, ShadingType, Table, TableCell, TableRow, WidthType } from "docx";
import type { ActionItem, MinutesLang, OpenIssue } from "@recap/core";
import { formatOffset } from "./format";
import { LABELS } from "./labels";
import { COLOR, CONTENT_WIDTH, SIZE, run } from "./theme";
import { buildSectionHeading } from "./title-block";

const COLUMN_SHARES = [0.56, 0.24, 0.2];
const line = { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule };
const borders = { top: line, bottom: line, left: line, right: line };

function cell(text: string, width: number, head = false, suffix?: string): TableCell {
  const children = [run(text, { bold: head, size: head ? SIZE.small : SIZE.body })];
  if (suffix) children.push(run(`  [${suffix}]`, { color: COLOR.muted, size: SIZE.small }));
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    shading: head ? { type: ShadingType.CLEAR, fill: COLOR.headerFill, color: "auto" } : undefined,
    children: [new Paragraph({ spacing: { line: 280 }, children })],
  });
}

export function buildActionTable(items: ActionItem[], lang: MinutesLang): Table {
  const l = LABELS[lang];
  const widths = COLUMN_SHARES.map((s) => Math.round(CONTENT_WIDTH * s));
  const head = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [l.task, l.owner, l.due].map((t, i) => cell(t, widths[i] ?? 0, true)),
  });
  const rows = items.map(
    (it) =>
      new TableRow({
        cantSplit: true,
        children: [
          cell(
            it.task,
            widths[0] ?? 0,
            false,
            it.atMs === null ? undefined : formatOffset(it.atMs),
          ),
          cell(it.owner ?? "—", widths[1] ?? 0),
          cell(it.due ?? "—", widths[2] ?? 0),
        ],
      }),
  );
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [head, ...rows],
  });
}

export function buildActionSection(items: ActionItem[], lang: MinutesLang): (Paragraph | Table)[] {
  const heading = buildSectionHeading(LABELS[lang].actionItems);
  if (items.length === 0) {
    return [
      heading,
      new Paragraph({ children: [run(LABELS[lang].noActions, { color: COLOR.muted })] }),
    ];
  }
  return [heading, buildActionTable(items, lang)];
}

export function buildOpenIssues(issues: OpenIssue[], lang: MinutesLang): Paragraph[] {
  if (issues.length === 0) return [];
  return [
    buildSectionHeading(LABELS[lang].openIssues),
    ...issues.map(
      (i) =>
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60, line: 290 },
          children: [run(i.text)],
        }),
    ),
  ];
}
