/**
 * Layah Word document design system: ONE look for every teaching document (lesson plan, worksheet, assessment,
 * homework, teacher's notes, AFL sheets). Content is never reworded; it is laid out:
 *   - A4, ~2 cm margins, a page border in the document's accent colour on every page (Word page borders);
 *   - Calibri; real Heading 1/2/3 styles (Navigation Pane works, everything stays editable);
 *   - header (logo · document type · lesson title) and footer (Page X of Y · Created with Layah);
 *   - a title banner, an info table, tinted section bands, bordered tables with repeating header rows, callout boxes,
 *     real Word lists (no typed "•"), and per-document structure (questions with a marks column, MCQ option grids,
 *     one lesson-flow table, homework task and checklist tables, the answer key on its own teacher-only page).
 * Colours print clearly in greyscale: dark shades for text and banners (white bold text only on dark), light tints
 * for fills.
 */
import { readFile } from "fs/promises";
import path from "path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBorderDisplay,
  PageBorderOffsetFrom,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
} from "docx";

// ── Tokens ────────────────────────────────────────────────────────────────────

export type DocKind = "lesson" | "worksheet" | "assessment" | "homework" | "notes" | "afl";
export type KeyWord = { word: string; meaning: string; usedIn?: string };

type Theme = { label: string; dark: string; mid: string; tint: string; student: boolean };

/** Layah teal (#278263, brand token l-green-9) leads; each document type has its own accent. */
export const DOC_THEMES: Record<DocKind, Theme> = {
  lesson: { label: "Lesson Plan", dark: "1B5E47", mid: "278263", tint: "E4F2EC", student: false },
  worksheet: { label: "Worksheet", dark: "1E4E8C", mid: "2F6DB5", tint: "E6EEF9", student: true },
  assessment: { label: "Assessment", dark: "4B2E83", mid: "6B46B0", tint: "EFE9F8", student: true },
  homework: { label: "Homework", dark: "8A4B08", mid: "C2680F", tint: "FCF0E2", student: true },
  notes: { label: "Teacher's Notes", dark: "2D3A55", mid: "4A5D85", tint: "E9EDF4", student: false },
  afl: { label: "Activity Sheet", dark: "0F5C66", mid: "1A8796", tint: "E2F3F5", student: true },
};

const FONT = "Calibri";
const INK = "1F2933";
const MUTED = "5B6675";
const GRID = "B8C4D6"; // thin light grey-blue table borders
const ZEBRA = "F6F8FB";
const PAGE_W = 11906; // A4 portrait, twips
const PAGE_H = 16838;
const MARGIN = 1134; // 2 cm
const CONTENT_W = PAGE_W - 2 * MARGIN;
const PT = (n: number) => n * 2; // docx sizes are half-points

/** Light tints for lesson-flow phases, so each phase row is easy to find. */
const PHASE_TINTS: [RegExp, string][] = [
  [/starter|hook|warm[- ]?up|engage/i, "FFF4D6"],
  [/differentiat/i, "E6F6EE"],
  [/afl|check|assessment|mini[- ]?plenary/i, "F1E9FB"],
  [/plenary|reflect|closing|review/i, "FDE9EC"],
  [/main|teach|explor|activity|guided|independent|core/i, "E3F0FF"],
];
const phaseTint = (phase: string) => PHASE_TINTS.find(([re]) => re.test(phase))?.[1] ?? "F2F4F7";

export function kindFromTitle(title: string): DocKind {
  if (/worksheet/i.test(title)) return "worksheet";
  if (/assessment|question/i.test(title)) return "assessment";
  if (/homework/i.test(title)) return "homework";
  if (/teacher/i.test(title)) return "notes";
  if (/afl|activity sheet/i.test(title)) return "afl";
  return "lesson";
}

// ── Inline text ───────────────────────────────────────────────────────────────

/** **bold**, *italic*, `code` into runs; typed bullets and stray markdown are removed. */
function runs(text: string, opts: { size?: number; color?: string; bold?: boolean } = {}): TextRun[] {
  const base = { font: FONT, size: opts.size ?? PT(11), color: opts.color ?? INK, bold: opts.bold };
  const out: TextRun[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const clean = text.replace(/<br\s*\/?>/gi, " ");
  while ((m = re.exec(clean)) !== null) {
    if (m.index > last) out.push(new TextRun({ ...base, text: clean.slice(last, m.index) }));
    if (m[2]) out.push(new TextRun({ ...base, text: m[2], bold: true }));
    else if (m[4]) out.push(new TextRun({ ...base, text: m[4], italics: true }));
    else if (m[6]) out.push(new TextRun({ ...base, text: m[6] }));
    last = m.index + m[0].length;
  }
  if (last < clean.length) out.push(new TextRun({ ...base, text: clean.slice(last) }));
  return out.length ? out : [new TextRun({ ...base, text: "" })];
}

const plain = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1").trim();

// ── Markdown → blocks ─────────────────────────────────────────────────────────

type Block =
  | { t: "h"; level: number; text: string }
  | { t: "table"; header: string[]; rows: string[][] }
  | { t: "li"; ordered: boolean; n?: number; text: string; depth: number }
  | { t: "check"; checked: boolean; text: string }
  | { t: "p"; text: string }
  | { t: "lines"; count: number };

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const splitRow = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

export function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trim();
    if (!line || /^```/.test(line) || /^(-{3,}|\*{3,}|_{3,}\s*$)$/.test(line) && !/_{3,}/.test(line)) continue;
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]!.trim())) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i]!.trim())) rows.push(splitRow(lines[i++]!));
      i--;
      blocks.push({ t: "table", header, rows: rows.map((r) => header.map((_, c) => r[c] ?? "")) });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push({ t: "h", level: h[1]!.length, text: plain(h[2]!) });
      continue;
    }
    // A short line that is all bold works as a heading in generated text ("**Section A: Recall**").
    const boldLine = line.match(/^\*\*([^*]{2,90})\*\*:?$/);
    if (boldLine) {
      blocks.push({ t: "h", level: 3, text: boldLine[1]!.trim() });
      continue;
    }
    if (/^_{3,}[\s_]*$/.test(line)) {
      const prev = blocks[blocks.length - 1];
      if (prev?.t === "lines") prev.count++;
      else blocks.push({ t: "lines", count: 1 });
      continue;
    }
    const depth = Math.min(2, Math.floor((raw.match(/^\s*/)?.[0].length ?? 0) / 2));
    const check = line.match(/^(?:[-*•]\s*)?\[( |x|X)\]\s+(.*)$/);
    if (check) {
      blocks.push({ t: "check", checked: check[1]!.toLowerCase() === "x", text: check[2]! });
      continue;
    }
    const num = line.match(/^(\d{1,2})[.)]\s+(.*)$/);
    if (num) {
      blocks.push({ t: "li", ordered: true, n: Number(num[1]), text: num[2]!, depth });
      continue;
    }
    // Symbol bullets count with or without a space; "-", "*", "+" only with one, so "**Bold:** text" keeps its "**".
    const bullet = line.match(/^(?:[•·▪●◦]\s*|[-*+]\s+)+(.*)$/);
    if (bullet) {
      blocks.push({ t: "li", ordered: false, text: bullet[1]!, depth });
      continue;
    }
    blocks.push({ t: "p", text: line });
  }
  return attachLooseMarks(blocks);
}

/**
 * Generated worksheets sometimes put a question's marks on their own line, often after its table ("(5 marks)"). That
 * line belongs to the nearest earlier question in the same section, so it is moved into that question's marks.
 */
function attachLooseMarks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    const loose = b.t === "p" ? b.text.match(/^\(?\[?\s*(\d{1,3})\s*marks?\s*\]?\)?\.?$/i) : null;
    if (loose) {
      for (let k = out.length - 1; k >= 0; k--) {
        const prev = out[k]!;
        if (prev.t === "h") break;
        if (prev.t === "li" && prev.ordered && prev.depth === 0) {
          if (!/\bmarks?\b/i.test(prev.text)) prev.text = `${prev.text} (${loose[1]} marks)`;
          break;
        }
      }
      continue;
    }
    out.push(b);
  }
  return out;
}

// ── Building blocks ───────────────────────────────────────────────────────────

type CellBorders = { top: IBorderOptions; bottom: IBorderOptions; left: IBorderOptions; right: IBorderOptions };
const cellBorders = (color = GRID): CellBorders => {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
};
const NO_BORDERS = (() => {
  const b = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
})();
const MARGINS = { top: 90, bottom: 90, left: 140, right: 140 };
const NO_CELL_BORDERS: CellBorders = { top: NO_BORDERS.top, bottom: NO_BORDERS.bottom, left: NO_BORDERS.left, right: NO_BORDERS.right };

function p(text: string, opts: { size?: number; color?: string; bold?: boolean; after?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}): Paragraph {
  return new Paragraph({ children: runs(text, opts), spacing: { after: opts.after ?? 80 }, alignment: opts.align });
}

function cell(children: (Paragraph | Table)[], opts: { width: number; fill?: string; span?: number; borders?: CellBorders } = { width: 0 }): TableCell {
  return new TableCell({
    children,
    width: { size: opts.width, type: WidthType.DXA },
    margins: MARGINS,
    verticalAlign: VerticalAlign.TOP,
    borders: opts.borders ?? cellBorders(),
    ...(opts.span ? { columnSpan: opts.span } : {}),
    ...(opts.fill ? { shading: { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" } } : {}),
  });
}

/** Column widths from content length, with narrow columns for time/marks/number. */
function columnWidths(header: string[], rows: string[][], total = CONTENT_W): number[] {
  const narrow = /^(time|duration|mins?|minutes|marks?|no\.?|#|q\.?|step|level|check|✓)$/i;
  const weights = header.map((h, c) => {
    if (narrow.test(plain(h))) return 0.6;
    const lens = [h, ...rows.map((r) => r[c] ?? "")].map((s) => plain(s).length);
    return Math.max(1, Math.min(4, (lens.reduce((a, b) => a + b, 0) / lens.length) / 18));
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.round((w / sum) * total));
  // Never so narrow that a word or "0–2 min" breaks mid-word: lift small columns, take it from the widest.
  const MIN = header.map((h) => (narrow.test(plain(h)) ? 1000 : /^phase$/i.test(plain(h)) ? 1500 : 1150));
  for (let c = 0; c < widths.length; c++) {
    if (widths[c]! < MIN[c]!) {
      const widest = widths.indexOf(Math.max(...widths));
      widths[widest]! -= MIN[c]! - widths[c]!;
      widths[c] = MIN[c]!;
    }
  }
  widths[widths.length - 1]! += total - widths.reduce((a, b) => a + b, 0);
  return widths;
}

/** Bordered table: coloured bold header row (repeats on every page), zebra rows, rows never split across pages. */
function dataTable(header: string[], rows: string[][], theme: Theme, opts: { widths?: number[]; rowFills?: (string | undefined)[]; total?: number } = {}): Table {
  const widths = opts.widths ?? columnWidths(header, rows, opts.total);
  const head = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: header.map((h, c) => cell([p(plain(h), { bold: true, color: theme.dark, size: PT(10), after: 0 })], { width: widths[c]!, fill: theme.tint })),
  });
  const body = rows.map((r, ri) => new TableRow({
    cantSplit: true,
    children: r.map((v, c) => cell(
      v.split(/<br\s*\/?>/i).map((part) => p(part, { size: PT(10), after: 0 })),
      { width: widths[c]!, fill: opts.rowFills?.[ri] ?? (ri % 2 === 1 ? ZEBRA : undefined) },
    )),
  }));
  return new Table({ rows: [head, ...body], width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED });
}

/** A single-cell callout ("Key Words", "Remember", "Tip", ...) with a coloured left border. */
function box(label: string, children: (Paragraph | Table)[], fill: string, accent: string): Table {
  const thin = { style: BorderStyle.SINGLE, size: 4, color: fill };
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({
      cantSplit: children.length < 12,
      children: [new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        shading: { fill, type: ShadingType.CLEAR, color: "auto" },
        borders: { top: thin, bottom: thin, right: thin, left: { style: BorderStyle.SINGLE, size: 36, color: accent } },
        children: [p(label, { bold: true, color: accent, size: PT(11), after: 60 }), ...children],
      })],
    })],
  });
}

const spacer = (after = 120) => new Paragraph({ children: [], spacing: { after } });

/** Section band: Heading 1 with a tinted fill, dark bold text and an accent rule on the left. */
function band(text: string, theme: Theme, opts: { pageBreakBefore?: boolean } = {}): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    keepLines: true,
    pageBreakBefore: opts.pageBreakBefore,
    shading: { fill: theme.tint, type: ShadingType.CLEAR, color: "auto" },
    border: { left: { style: BorderStyle.SINGLE, size: 36, color: theme.mid, space: 6 } },
    spacing: { before: 260, after: 140 },
    children: [new TextRun({ text, bold: true, color: theme.dark, size: PT(14), font: FONT })],
  });
}

function subHeading(text: string, level: 2 | 3, theme: Theme): Paragraph {
  return new Paragraph({
    heading: level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    keepNext: true,
    keepLines: true,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, color: theme.dark, size: level === 2 ? PT(12) : PT(11), font: FONT })],
  });
}

const answerLine = () => new Paragraph({
  children: [],
  spacing: { before: 200, after: 0 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "9AA5B4", space: 1 } },
});

// ── Key words ─────────────────────────────────────────────────────────────────

function keyWordsFull(words: KeyWord[], theme: Theme): (Paragraph | Table)[] {
  return [
    band("Key Words", theme),
    dataTable(["Keyword", "Simple meaning", "Used in"], words.map((w) => [`**${w.word}**`, w.meaning, w.usedIn ?? ""]), theme, { widths: [2300, 5000, CONTENT_W - 7300] }),
    spacer(),
  ];
}

function keyWordsBox(words: KeyWord[], theme: Theme): (Paragraph | Table)[] {
  const inner = new Table({
    width: { size: CONTENT_W - 440, type: WidthType.DXA },
    columnWidths: [2200, CONTENT_W - 440 - 2200],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: words.map((w) => new TableRow({
      cantSplit: true,
      children: [
        cell([p(w.word, { bold: true, size: PT(10), after: 0, color: theme.dark })], { width: 2200, borders: NO_CELL_BORDERS }),
        cell([p(w.meaning, { size: PT(10), after: 0 })], { width: CONTENT_W - 440 - 2200, borders: NO_CELL_BORDERS }),
      ],
    })),
  });
  return [box("Key Words", [inner], theme.tint, theme.mid), spacer()];
}

// ── Page furniture ────────────────────────────────────────────────────────────

let logoCache: Buffer | null | undefined;
async function logo(): Promise<Buffer | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = await readFile(path.join(process.cwd(), "public", "docx-logo.png"));
  } catch {
    logoCache = null;
  }
  return logoCache;
}

function header(logoPng: Buffer | null, theme: Theme, docLabel: string, lessonTitle: string): Header {
  return new Header({
    children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: theme.mid, space: 4 } },
      spacing: { after: 120 },
      children: [
        // The icon mark plus a dark wordmark: the full logo's light lettering is too faint on white paper.
        ...(logoPng ? [new ImageRun({ type: "png", data: logoPng, transformation: { width: 24, height: 23 } })] : []),
        new TextRun({ text: logoPng ? "  Layah" : "Layah", bold: true, color: theme.dark, font: FONT, size: PT(12) }),
        new TextRun({ text: `\t${docLabel}  ·  ${lessonTitle}`, color: MUTED, font: FONT, size: PT(9) }),
      ],
    })],
  });
}

function footer(theme: Theme): Footer {
  return new Footer({
    children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: GRID, space: 4 } },
      children: [
        new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], color: MUTED, font: FONT, size: PT(9) }),
        new TextRun({ text: "\tCreated with Layah", color: theme.dark, font: FONT, size: PT(9), bold: true }),
      ],
    })],
  });
}

function titleBlock(theme: Theme, params: BuildParams, extras: { totalMarks?: number; duration?: string }): (Paragraph | Table)[] {
  const dark = { style: BorderStyle.SINGLE, size: 4, color: theme.dark };
  const banner = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        margins: { top: 200, bottom: 200, left: 280, right: 280 },
        shading: { fill: theme.dark, type: ShadingType.CLEAR, color: "auto" },
        borders: { top: dark, bottom: dark, left: dark, right: dark },
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 60 }, children: [new TextRun({ text: params.documentTitle, bold: true, color: "FFFFFF", size: PT(22), font: FONT })] }),
          new Paragraph({ children: [new TextRun({ text: params.topic, bold: true, color: "FFFFFF", size: PT(12), font: FONT })] }),
        ],
      })],
    })],
  });
  const blank = "";
  const L = 1700;
  const V = (CONTENT_W - 2 * L) / 2;
  const label = (t: string) => cell([p(t, { bold: true, size: PT(10), color: theme.dark, after: 0 })], { width: L, fill: theme.tint });
  const value = (t: string, span?: number) => cell([p(t, { size: PT(10), after: 0 })], { width: span ? V * 2 + L : V, span });
  const topic = params.chapter?.trim() && !params.chapter.trim().toLowerCase().includes(params.topic.toLowerCase())
    ? `${params.chapter.trim()} — ${params.topic}`
    : params.chapter?.trim() || params.topic;
  const rows: TableRow[] = [
    new TableRow({ cantSplit: true, children: [label("Subject"), value(params.subject), label("Grade"), value(params.grade)] }),
    new TableRow({ cantSplit: true, children: [label("Chapter / Topic"), value(topic, 3)] }),
    new TableRow({ cantSplit: true, children: [label("Date"), value(blank), label(params.kind === "assessment" ? "Time" : "Duration"), value(extras.duration ?? blank)] }),
    new TableRow({ cantSplit: true, children: [label("Teacher"), value(params.teacherName ?? blank), label("Class"), value(blank)] }),
    ...(params.kind === "assessment" ? [new TableRow({ cantSplit: true, children: [label("Total marks"), value(extras.totalMarks ? String(extras.totalMarks) : blank, 3)] })] : []),
  ];
  const info = new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [L, V, L, V], layout: TableLayoutType.FIXED, rows });
  const out: (Paragraph | Table)[] = [banner, spacer(160), info, spacer(160)];
  if (theme.student) {
    const w = CONTENT_W / 3;
    const line = (t: string) => cell([p(`${t}: ____________________`, { size: PT(11), after: 0 })], { width: w, borders: NO_CELL_BORDERS });
    out.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [w, w, w], layout: TableLayoutType.FIXED, borders: NO_BORDERS, rows: [new TableRow({ children: [line("Name"), line("Class"), line("Date")] })] }), spacer(160));
  }
  if (params.kind === "homework") out.push(box("Due date", [p("Hand this in on: ______________________", { after: 0 })], theme.tint, theme.mid), spacer());
  return out;
}

// ── Document-specific structure ───────────────────────────────────────────────

const MARKS_RE = /\s*[([]\s*(\d{1,3})\s*marks?\s*[)\]]\s*$|\s*[-–—:]\s*(\d{1,3})\s*marks?\s*$/i;
const OPTION_RE = /^\(?([a-dA-D])[).:]\s+(.*)$/;
const TIME_RE = /\s*[([]\s*(\d{1,3}\s*(?:[-–]\s*\d{1,3})?\s*(?:min(?:ute)?s?|hours?))\s*[)\]]\s*$/i;
const ANSWER_KEY_RE = /answer\s*key|mark(?:ing)?\s*scheme|model\s*answers|^answers?$|suggested\s*answers/i;
const INTRO_RE = /instruction|what to do|how to|overview|summary|at a glance|introduction|before you start/i;

type Question = { n: number; text: string; marks?: number; options: string[][]; extras: string[]; hasLines: boolean };

/** Collects a run of numbered questions with their options, sub-points and answer lines. */
function collectQuestions(blocks: Block[], start: number): { questions: Question[]; next: number } {
  const questions: Question[] = [];
  let i = start;
  while (i < blocks.length) {
    const b = blocks[i]!;
    if (b.t === "li" && b.ordered && b.depth === 0) {
      const m = b.text.match(MARKS_RE);
      questions.push({ n: b.n ?? questions.length + 1, text: m ? b.text.slice(0, m.index).trim() : b.text, marks: m ? Number(m[1] ?? m[2]) : undefined, options: [], extras: [], hasLines: false });
      i++;
      continue;
    }
    const q = questions[questions.length - 1];
    if (!q) break;
    const text = b.t === "li" || b.t === "p" ? b.text : "";
    const option = text.match(OPTION_RE);
    if (option) q.options.push([option[1]!.toUpperCase(), option[2]!]);
    else if (b.t === "lines") q.hasLines = true;
    else if (b.t === "li" && (b.depth > 0 || !b.ordered)) q.extras.push(b.text);
    else if (b.t === "p" && !/^#/.test(b.text) && !/^\**section\b/i.test(b.text)) q.extras.push(b.text);
    else break;
    i++;
  }
  return { questions, next: i };
}

function questionTable(questions: Question[], theme: Theme, kind: DocKind, answerKey = false, total = CONTENT_W): Table {
  const withMarks = questions.some((q) => q.marks !== undefined);
  const numW = 700;
  const marksW = withMarks ? 1000 : 0;
  const qW = total - numW - marksW;
  const header = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      cell([p("No.", { bold: true, size: PT(10), color: theme.dark, after: 0 })], { width: numW, fill: theme.tint }),
      cell([p(answerKey ? "Answer" : "Question", { bold: true, size: PT(10), color: theme.dark, after: 0 })], { width: qW, fill: theme.tint }),
      ...(withMarks ? [cell([p("Marks", { bold: true, size: PT(10), color: theme.dark, after: 0, align: AlignmentType.RIGHT })], { width: marksW, fill: theme.tint })] : []),
    ],
  });
  const rows = questions.map((q) => {
    const content: (Paragraph | Table)[] = [p(q.text, { after: 60 })];
    if (q.options.length) {
      const optW = Math.floor((qW - 300) / 2);
      const pairs: string[][][] = [];
      for (let k = 0; k < q.options.length; k += 2) pairs.push(q.options.slice(k, k + 2));
      content.push(new Table({
        width: { size: optW * 2, type: WidthType.DXA },
        columnWidths: [optW, optW],
        layout: TableLayoutType.FIXED,
        borders: NO_BORDERS,
        rows: pairs.map((pair) => new TableRow({
          cantSplit: true,
          children: [0, 1].map((k) => cell(
            pair[k] ? [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: `${pair[k]![0]}   `, bold: true, color: theme.dark, font: FONT, size: PT(10) }), ...runs(pair[k]![1]!, { size: PT(10) })] })] : [p("", { after: 0 })],
            { width: optW, borders: NO_CELL_BORDERS },
          )),
        })),
      }));
    }
    for (const extra of q.extras) content.push(p(extra, { size: PT(10), color: MUTED, after: 40 }));
    if (!answerKey && (kind === "worksheet" || kind === "afl" || kind === "homework") && !q.options.length) {
      content.push(answerLine(), answerLine());
    }
    return new TableRow({
      cantSplit: true,
      children: [
        cell([p(String(q.n), { bold: true, color: theme.dark, after: 0 })], { width: numW }),
        cell(content, { width: qW }),
        ...(withMarks ? [cell([p(q.marks !== undefined ? `[${q.marks}]` : "", { size: PT(10), after: 0, align: AlignmentType.RIGHT, color: MUTED })], { width: marksW })] : []),
      ],
    });
  });
  return new Table({ rows: [header, ...rows], width: { size: total, type: WidthType.DXA }, columnWidths: withMarks ? [numW, qW, marksW] : [numW, qW], layout: TableLayoutType.FIXED });
}

/** Lesson plan: consecutive "## Phase" + timed table pairs become ONE lesson-flow table, phase rows tinted. */
function mergeLessonFlow(blocks: Block[]): Block[] {
  const isFlow = (b: Block | undefined): b is Extract<Block, { t: "table" }> =>
    !!b && b.t === "table" && b.header.some((h) => /time/i.test(h)) && b.header.some((h) => /activity|teacher|student/i.test(h));
  const out: Block[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const h = blocks[i]!;
    if (h.t === "h" && isFlow(blocks[i + 1])) {
      const header = (blocks[i + 1] as Extract<Block, { t: "table" }>).header;
      const rows: string[][] = [];
      let j = i;
      while (j < blocks.length && blocks[j]!.t === "h" && isFlow(blocks[j + 1]) && (blocks[j + 1] as Extract<Block, { t: "table" }>).header.join("|") === header.join("|")) {
        const phase = (blocks[j] as Extract<Block, { t: "h" }>).text.replace(/\(.*?\)/g, "").replace(/[:–—-]\s*$/, "").trim();
        for (const r of (blocks[j + 1] as Extract<Block, { t: "table" }>).rows) rows.push([phase, ...r]);
        j += 2;
      }
      if (rows.length && j - i >= 2) {
        out.push({ t: "h", level: 2, text: "Lesson Flow" }, { t: "table", header: ["Phase", ...header], rows });
        i = j - 1;
        continue;
      }
    }
    out.push(h);
  }
  return out;
}

/** Marks per section, for the assessment summary table. */
function marksBySection(blocks: Block[]): { section: string; questions: number; marks: number }[] {
  const sections: { section: string; questions: number; marks: number }[] = [];
  let current = { section: "Questions", questions: 0, marks: 0 };
  for (const b of blocks) {
    if (b.t === "h" && ANSWER_KEY_RE.test(b.text)) break;
    if (b.t === "h" && b.level <= 3) {
      if (current.questions) sections.push(current);
      current = { section: b.text, questions: 0, marks: 0 };
    }
    if (b.t === "li" && b.ordered && b.depth === 0) {
      const m = b.text.match(MARKS_RE);
      current.questions++;
      current.marks += m ? Number(m[1] ?? m[2]) : 0;
    }
  }
  if (current.questions) sections.push(current);
  return sections;
}

// ── Renderer ──────────────────────────────────────────────────────────────────

type BuildParams = {
  kind: DocKind;
  documentTitle: string;
  subject: string;
  grade: string;
  topic: string;
  chapter?: string;
  teacherName?: string;
  content: string;
  keyWords?: KeyWord[];
  /** Internal: the width tables get, narrower inside a callout box. */
  width?: number;
};

function render(blocks: Block[], theme: Theme, params: BuildParams): (Paragraph | Table)[] {
  const kind = params.kind;
  const width = params.width ?? CONTENT_W;
  const out: (Paragraph | Table)[] = [];
  const words = params.keyWords?.length ? params.keyWords : undefined;
  let numberingInstance = 0;
  let keyWordsPlaced = !words || kind === "assessment" || kind === "afl";

  // Where the key words go: lesson plan right after the objectives section; other documents after the intro.
  let keyWordsAt = -1;
  if (!keyWordsPlaced) {
    if (kind === "lesson") {
      const obj = blocks.findIndex((b) => b.t === "h" && /objective/i.test(b.text));
      if (obj >= 0) {
        const lvl = (blocks[obj] as Extract<Block, { t: "h" }>).level;
        const after = blocks.findIndex((b, k) => k > obj && b.t === "h" && b.level <= lvl);
        keyWordsAt = after >= 0 ? after : blocks.length;
      } else keyWordsAt = 0;
    } else {
      const firstSection = blocks.findIndex((b) => b.t === "h" && !INTRO_RE.test(b.text));
      const intro = blocks.findIndex((b) => b.t === "h" && INTRO_RE.test(b.text));
      keyWordsAt = intro >= 0 && (firstSection < 0 || intro < firstSection) && firstSection >= 0 ? firstSection : intro >= 0 && firstSection < 0 ? blocks.length : 0;
    }
  }
  const placeKeyWords = () => {
    if (keyWordsPlaced || !words) return;
    out.push(...(kind === "lesson" ? keyWordsFull(words, theme) : keyWordsBox(words, theme)));
    keyWordsPlaced = true;
  };

  const marksSummary = kind === "assessment" ? marksBySection(blocks) : [];
  const totalMarks = marksSummary.reduce((a, s) => a + s.marks, 0);
  let summaryPlaced = totalMarks === 0;
  const placeSummary = () => {
    if (summaryPlaced) return;
    out.push(band("Marks Summary", theme), dataTable(["Section", "Questions", "Marks"], [...marksSummary.map((s) => [s.section, String(s.questions), String(s.marks)]), ["**Total**", String(marksSummary.reduce((a, s) => a + s.questions, 0)), `**${totalMarks}**`]], theme, { widths: [CONTENT_W - 3000, 1500, 1500] }), spacer());
    summaryPlaced = true;
  };

  // Homework gets one "Show your work" space after its tasks: before the checklist, or at the end.
  let showWorkPending = false;
  const placeShowWork = () => {
    if (!showWorkPending) return;
    out.push(box("Show your work", [spacer(1600), spacer(1600)], "FFFFFF", theme.mid), spacer());
    showWorkPending = false;
  };
  let inAnswerKey = false;
  let taskCount = 0;

  let i = 0;
  while (i < blocks.length) {
    if (i === keyWordsAt) placeKeyWords();
    const b = blocks[i]!;

    if (b.t === "h") {
      const isAnswerKey = (kind === "assessment" || kind === "worksheet" || kind === "homework") && ANSWER_KEY_RE.test(b.text);
      if (/checklist/i.test(b.text)) placeShowWork();
      if (isAnswerKey) {
        placeShowWork();
        inAnswerKey = true;
        placeSummary();
        out.push(band(b.text, theme, { pageBreakBefore: true }), p("For teacher use only — remove before giving this to students.", { bold: true, color: "9B1C1C", size: PT(10), after: 160 }));
        i++;
        continue;
      }
      // Headings that introduce a callout: the content up to the next heading goes inside a box.
      const calloutKind = /challenge|extension|stretch/i.test(b.text) ? "challenge"
        : INTRO_RE.test(b.text) && kind !== "lesson" ? "intro"
        : /tips?\b|teacher tips/i.test(b.text) ? "tip"
        : /reflection/i.test(b.text) ? "reflect"
        : undefined;
      if (calloutKind) {
        const end = (() => { const k = blocks.findIndex((x, idx) => idx > i && x.t === "h" && x.level <= b.level); return k < 0 ? blocks.length : k; })();
        const inner = render(blocks.slice(i + 1, end), theme, { ...params, keyWords: undefined, content: "", width: width - 500 });
        const fill = calloutKind === "challenge" ? "FFF4D6" : calloutKind === "reflect" ? "F2F4F7" : theme.tint;
        const accent = calloutKind === "challenge" ? "B7791F" : theme.mid;
        out.push(box(b.text, inner.length ? inner : [p("", { after: 0 })], fill, accent), spacer());
        if (calloutKind === "reflect") out.push(answerLine(), answerLine(), spacer());
        i = end;
        continue;
      }
      out.push(b.level <= 2 ? band(b.text, theme) : subHeading(b.text, b.level === 3 ? 2 : 3, theme));
      i++;
      continue;
    }

    if (b.t === "table") {
      const isFlow = kind === "lesson" && b.header[0] === "Phase";
      out.push(dataTable(b.header, b.rows, theme, { total: width, ...(isFlow ? { rowFills: b.rows.map((r) => phaseTint(r[0] ?? "")) } : {}) }), spacer());
      i++;
      continue;
    }

    if (b.t === "check") {
      placeShowWork();
      const items: string[] = [];
      while (i < blocks.length && blocks[i]!.t === "check") items.push((blocks[i++] as Extract<Block, { t: "check" }>).text);
      out.push(dataTable(["✓", "I have…"], items.map((t) => ["☐", t]), theme, { widths: [700, CONTENT_W - 700] }), spacer());
      continue;
    }

    if (b.t === "li" && b.ordered && b.depth === 0 && (kind === "worksheet" || kind === "assessment" || kind === "afl")) {
      const { questions, next } = collectQuestions(blocks, i);
      if (questions.length) {
        out.push(questionTable(questions, theme, kind, inAnswerKey, width), spacer());
        i = next;
        continue;
      }
    }

    if (b.t === "li" && b.ordered && b.depth === 0 && kind === "homework" && !inAnswerKey) {
      const tasks: string[][] = [];
      while (i < blocks.length && blocks[i]!.t === "li" && (blocks[i] as Extract<Block, { t: "li" }>).ordered) {
        const t = (blocks[i++] as Extract<Block, { t: "li" }>).text;
        const time = t.match(TIME_RE);
        const body = time ? t.slice(0, time.index).trim() : t;
        const [name, ...rest] = body.split(/:\s+/);
        tasks.push([`Task ${++taskCount}`, rest.length ? `**${name}:** ${rest.join(": ")}` : body, time?.[1] ?? ""]);
      }
      out.push(dataTable(["Task", "What to do", "Time"], tasks, theme, { widths: [1100, CONTENT_W - 2300, 1200] }), spacer());
      showWorkPending = true;
      continue;
    }

    if (b.t === "li") {
      const ordered = b.ordered;
      const instance = ++numberingInstance;
      while (i < blocks.length && blocks[i]!.t === "li" && ((blocks[i] as Extract<Block, { t: "li" }>).ordered === ordered || (blocks[i] as Extract<Block, { t: "li" }>).depth > 0)) {
        const li = blocks[i++] as Extract<Block, { t: "li" }>;
        out.push(new Paragraph({
          numbering: { reference: li.ordered ? "layah-numbers" : "layah-bullets", level: li.depth, instance: li.ordered ? instance : undefined },
          spacing: { after: 60 },
          children: runs(li.text),
        }));
      }
      out.push(spacer(80));
      continue;
    }

    if (b.t === "lines") {
      for (let k = 0; k < b.count; k++) out.push(answerLine());
      i++;
      continue;
    }

    // Paragraphs: "Tip:", "Remember:", "Learning objective:", "Note:" become callout boxes.
    const callout = b.text.match(/^\**(tip|remember|note|key idea|learning objectives?|did you know)\**\s*[:–—-]\s*(.*)$/i);
    if (callout) {
      const label = callout[1]!.replace(/^\w/, (c) => c.toUpperCase());
      out.push(box(label, [p(callout[2]!, { after: 0 })], theme.tint, theme.mid), spacer());
    } else {
      out.push(p(b.text, { after: 120 }));
    }
    i++;
  }
  if (keyWordsAt >= blocks.length) placeKeyWords();
  placeShowWork();
  placeSummary();
  return out;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function buildDesignedDocx(params: BuildParams): Promise<Buffer> {
  const theme = DOC_THEMES[params.kind];
  let blocks = parseBlocks(params.content);
  if (params.kind === "lesson") blocks = mergeLessonFlow(blocks);
  // Only the lesson plan states the lesson's duration, and an assessment its time allowed; other documents mention
  // task times, which are not the duration.
  const duration = params.kind === "lesson"
    ? params.content.match(/\b(\d{2,3})\s*(?:minutes|mins)\b/i)?.[0]
    : params.kind === "assessment"
      ? params.content.match(/\btime(?:\s+allowed)?\s*[:\-–]?\s*(\d{1,3}\s*(?:minutes|mins|hours?))/i)?.[1]
      : undefined;
  const totalMarks = params.kind === "assessment" ? marksBySection(blocks).reduce((a, s) => a + s.marks, 0) : undefined;
  const logoPng = await logo();
  const border = { style: BorderStyle.SINGLE, size: 14, color: theme.mid, space: 20 };

  const doc = new Document({
    creator: "Layah",
    title: `${params.documentTitle} — ${params.topic}`,
    styles: {
      default: { document: { run: { font: FONT, size: PT(11), color: INK } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: FONT, size: PT(22), bold: true, color: "FFFFFF" } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: PT(14), bold: true, color: theme.dark }, paragraph: { spacing: { before: 260, after: 140 }, keepNext: true, keepLines: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: PT(12), bold: true, color: theme.dark }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, keepLines: true } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: PT(11), bold: true, color: theme.dark }, paragraph: { spacing: { before: 160, after: 60 }, keepNext: true, keepLines: true } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "layah-bullets",
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.BULLET,
            text: ["•", "◦", "▪"][level]!,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 400 + level * 360, hanging: 260 } }, run: { color: theme.mid } },
          })),
        },
        {
          reference: "layah-numbers",
          levels: [0, 1, 2].map((level) => ({
            level,
            format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level]!,
            text: `%${level + 1}.`,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 440 + level * 360, hanging: 320 } }, run: { color: theme.dark, bold: true } },
          })),
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN + 200, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 700, footer: 600 },
          borders: {
            pageBorders: { display: PageBorderDisplay.ALL_PAGES, offsetFrom: PageBorderOffsetFrom.PAGE },
            pageBorderTop: border, pageBorderBottom: border, pageBorderLeft: border, pageBorderRight: border,
          },
        },
      },
      headers: { default: header(logoPng, theme, theme.label, params.topic) },
      footers: { default: footer(theme) },
      children: [...titleBlock(theme, params, { totalMarks, duration }), ...render(blocks, theme, params)],
    }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
