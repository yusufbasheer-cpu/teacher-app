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
  ShadingType,
} from "docx";
import type { QuestionPaperBlueprint } from "@/lib/question-paper-blueprint";

const NAVY = "0A1628";
const TEAL = "00C6A7";
const ALT_ROW = "F0F4F8";
const WHITE = "FFFFFF";

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

const tableBorder = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: "B8C4CE",
};

const cellBorders = {
  top: tableBorder,
  bottom: tableBorder,
  left: tableBorder,
  right: tableBorder,
};

function headerCell(text: string): TableCell {
  return new TableCell({
    shading: { fill: NAVY, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    borders: cellBorders,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: WHITE, size: 20 })],
      }),
    ],
  });
}

function bodyCell(text: string, alt: boolean, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT): TableCell {
  return new TableCell({
    shading: alt ? { fill: ALT_ROW, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    borders: cellBorders,
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text: String(text), size: 20, color: "1A1A2E" })],
      }),
    ],
  });
}

function buildDataTable(headers: string[], rows: string[][], numericCols: number[] = []): Table {
  const tableRows: TableRow[] = [
    new TableRow({ children: headers.map((h) => headerCell(h)) }),
  ];
  rows.forEach((row, idx) => {
    const alt = idx % 2 === 1;
    tableRows.push(
      new TableRow({
        children: row.map((cell, colIdx) =>
          bodyCell(
            cell,
            alt,
            numericCols.includes(colIdx) ? AlignmentType.CENTER : AlignmentType.LEFT,
          ),
        ),
      }),
    );
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    children: [
      new TextRun({ text, bold: true, size: 26, color: NAVY }),
    ],
  });
}

export async function buildBlueprintDocxBuffer(params: {
  subject: string;
  grade: string;
  topic: string;
  curriculumType: string;
  timeAllowed: string;
  blueprint: QuestionPaperBlueprint;
}): Promise<Buffer> {
  const logoBuf = await loadLayahLogoBuffer();
  const children: (Paragraph | Table)[] = [];

  if (logoBuf) {
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: logoBuf,
            transformation: { width: 140, height: 48 },
            type: "png",
          }),
        ],
        spacing: { after: 160 },
      }),
    );
  } else {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Layah.ai", bold: true, size: 32, color: TEAL })],
        spacing: { after: 160 },
      }),
    );
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Examination Blueprint",
          bold: true,
          size: 40,
          color: NAVY,
        }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `School Name: _________________________________`,
          size: 22,
          color: "333333",
        }),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${params.subject}  ·  ${params.grade}  ·  ${params.topic}`,
          size: 22,
          color: "555577",
        }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Curriculum: ${params.curriculumType}  ·  Time allowed: ${params.timeAllowed}`,
          italics: true,
          size: 20,
          color: "666688",
        }),
      ],
      spacing: { after: 200 },
    }),
  );

  const bp = params.blueprint;

  children.push(sectionHeading("Table 1 — Chapter-wise distribution"));
  children.push(
    buildDataTable(
      ["Chapter / Topic", "Questions", "Marks", "% of paper"],
      bp.chapterWise.map((r) => [
        r.chapter,
        String(r.questions),
        String(r.marks),
        `${r.percent}%`,
      ]),
      [1, 2, 3],
    ),
  );

  children.push(sectionHeading("Table 2 — Bloom's taxonomy distribution"));
  children.push(
    buildDataTable(
      ["Bloom's level", "Questions", "Marks", "% of paper"],
      bp.bloomsTaxonomy.map((r) => [
        r.level,
        String(r.questions),
        String(r.marks),
        `${r.percent}%`,
      ]),
      [1, 2, 3],
    ),
  );

  children.push(sectionHeading("Table 3 — Question type distribution"));
  children.push(
    buildDataTable(
      ["Question type", "Questions", "Marks per question", "Total marks"],
      bp.questionTypes.map((r) => [
        r.type,
        String(r.questions),
        String(r.marksPerQuestion),
        String(r.totalMarks),
      ]),
      [1, 2, 3],
    ),
  );

  children.push(sectionHeading("Table 4 — Difficulty distribution"));
  children.push(
    buildDataTable(
      ["Difficulty", "Questions", "Marks"],
      bp.difficulty.map((r) => [r.level, String(r.questions), String(r.marks)]),
      [1, 2],
    ),
  );

  children.push(sectionHeading("Blueprint summary"));
  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `Total questions: ${bp.summary.totalQuestions}`,
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `Total marks: ${bp.summary.totalMarks}`,
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `Estimated completion time: ${bp.summary.estimatedCompletionTime}`,
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Syllabus coverage: ${bp.summary.syllabusCoveragePercent}%`,
          size: 22,
          bold: true,
          color: TEAL,
        }),
      ],
    }),
  );

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}

function parsePipeRow(line: string): string[] {
  return line
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  return /^\|?[\s:-]+\|[\s|:-]+\|?$/.test(t) || /^[-|:\s]+$/.test(t.replace(/\|/g, ""));
}

function blueprintPlainTextToDocxElements(text: string): (Paragraph | Table)[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i]?.trim() ?? "";
    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      out.push(sectionHeading(trimmed.slice(3).trim()));
      i += 1;
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.includes("|")) {
      const tableLines: string[] = [];
      while (i < lines.length) {
        const row = lines[i]?.trim() ?? "";
        if (!row.startsWith("|")) break;
        if (!isTableSeparator(row)) tableLines.push(row);
        i += 1;
      }
      if (tableLines.length >= 1) {
        const headers = parsePipeRow(tableLines[0]!);
        const dataRows = tableLines.slice(1).map(parsePipeRow).filter((r) => r.length > 0);
        if (headers.length > 0) {
          const numericCols = headers.map((_, idx) => idx).filter((idx) => idx > 0);
          out.push(buildDataTable(headers, dataRows, numericCols));
          continue;
        }
      }
      continue;
    }

    out.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: trimmed, size: 22, color: "1A1A2E" })],
      }),
    );
    i += 1;
  }

  return out;
}

/** Word export for plain-text blueprint (pipe tables → bordered docx tables). */
export async function buildBlueprintTextDocxBuffer(params: {
  subject: string;
  grade: string;
  topic: string;
  curriculumType: string;
  timeAllowed: string;
  totalMarks: number;
  blueprintText: string;
}): Promise<Buffer> {
  const logoBuf = await loadLayahLogoBuffer();
  const children: (Paragraph | Table)[] = [];

  if (logoBuf) {
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: logoBuf,
            transformation: { width: 140, height: 48 },
            type: "png",
          }),
        ],
        spacing: { after: 160 },
      }),
    );
  } else {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Layah.ai", bold: true, size: 32, color: TEAL })],
        spacing: { after: 160 },
      }),
    );
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Examination Blueprint",
          bold: true,
          size: 40,
          color: NAVY,
        }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Subject: ${params.subject}  ·  Grade: ${params.grade}`,
          size: 22,
          color: "555577",
        }),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Total Marks: ${params.totalMarks}  ·  Time Allowed: ${params.timeAllowed}`,
          size: 22,
          color: "555577",
        }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Topic: ${params.topic}  ·  Curriculum: ${params.curriculumType}`,
          italics: true,
          size: 20,
          color: "666688",
        }),
      ],
      spacing: { after: 200 },
    }),
    ...blueprintPlainTextToDocxElements(params.blueprintText.trim()),
  );

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
