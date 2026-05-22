import "server-only";

import { readFile } from "fs/promises";
import path from "path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { markdownToDocxParagraphs } from "@/lib/lesson-plan-export";

const NAVY = "0A1628";
const TEAL = "00C6A7";

let layahLogoCache: Buffer | null | undefined;

async function loadLayahLogoBuffer(): Promise<Buffer | null> {
  if (layahLogoCache !== undefined) return layahLogoCache;
  for (const fileName of ["Logo.png", "logo.png"]) {
    try {
      layahLogoCache = await readFile(path.join(process.cwd(), "public", fileName));
      return layahLogoCache;
    } catch {
      /* try next */
    }
  }
  layahLogoCache = null;
  return null;
}

const noBorder = {
  style: BorderStyle.NONE,
  size: 0,
  color: "FFFFFF",
};

const noCellBorders = {
  top: noBorder,
  bottom: noBorder,
  left: noBorder,
  right: noBorder,
};

function blankLine(label: string): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text: `${label}: `, bold: true, size: 22, color: NAVY }), new TextRun({ text: "_________________________", size: 22 })],
  });
}

function metaLine(text: string, boldLabel?: string): Paragraph {
  const children: TextRun[] = [];
  if (boldLabel) {
    children.push(new TextRun({ text: `${boldLabel}: `, bold: true, size: 22, color: NAVY }));
    children.push(new TextRun({ text, size: 22 }));
  } else {
    children.push(new TextRun({ text, size: 22 }));
  }
  return new Paragraph({ spacing: { after: 80 }, children });
}

function buildHeaderWithLogoRight(logoBuf: Buffer | null, title: string): Table {
  const logoParagraph = logoBuf
    ? new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new ImageRun({
            data: logoBuf,
            transformation: { width: 120, height: 42 },
            type: "png",
          }),
        ],
      })
    : new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "Layah.ai", bold: true, size: 28, color: TEAL })],
      });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 72, type: WidthType.PERCENTAGE },
            borders: noCellBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [new TextRun({ text: title, bold: true, size: 40, color: NAVY })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            borders: noCellBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [logoParagraph],
          }),
        ],
      }),
    ],
  });
}

export async function buildQuestionPaperDocxBuffer(params: {
  subject: string;
  grade: string;
  topic: string;
  totalMarks: number;
  timeAllowed: string;
  content: string;
}): Promise<Buffer> {
  const logoBuf = await loadLayahLogoBuffer();
  const children: (Paragraph | Table)[] = [
    buildHeaderWithLogoRight(logoBuf, "QUESTION PAPER"),
    new Paragraph({ spacing: { after: 120 } }),
    blankLine("School Name"),
    blankLine("Student Name"),
    blankLine("Date"),
    blankLine("Class"),
    metaLine(`${params.subject}  ·  ${params.grade}  ·  ${params.topic}`),
    metaLine(String(params.totalMarks), "Total Marks"),
    metaLine(params.timeAllowed, "Time Allowed"),
    new Paragraph({ spacing: { after: 200 } }),
    ...markdownToDocxParagraphs(params.content.trim()),
  ];

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
