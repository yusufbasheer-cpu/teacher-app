import { readFile } from "fs/promises";
import path from "path";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import {
  buildLessonPlanContextFromResult,
  buildStructuredLessonSlides,
  STRUCTURED_LESSON_DECK_SLIDE_COUNT,
  type StructuredLessonSlideModel,
} from "@/lib/ppt-structured-lesson";
import { formatDocxAflAppendix, sanitizeAflSelections, type AflSelectionsPayload } from "@/lib/afl-tools";
import {
  getPptSourceSlideOutline,
  TEACHER_PACKAGE_SECTIONS,
  parseSectionImagesMeta,
  type LessonPlanResult,
} from "@/lib/lesson-plan";
import {
  DEFAULT_PPT_THEME_ID,
  type PptRenderTheme,
  type PptThemeId,
  getPptRenderTheme,
} from "@/lib/ppt-themes";
import { buildPptxFromTemplateEngine } from "@/lib/ppt-template-engine";
import { fetchExternalImageSafely, sniffFileSignature } from "@/lib/upload-security";

const IN_SLIDE_W = 13.333333;
const IN_SLIDE_H = 7.5;
const IN_MARGIN = 0.3;
const PPT_TOP_BAR_H = 0.18;
const PPT_TITLE_H = 0.72;
const PPT_META_H = 0.22;
const PPT_LEFT_ACCENT_W = 0.1;
const PPT_IMG_W = 4.42;
const PPT_COL_GAP = 0.12;
const PPT_FOOTER_BLOCK = 0.34;
/** ~1 cm in inches (pptxgenjs uses inches). */
const PPT_LAYAH_LOGO_H = 0.39;
const PPT_LAYAH_LOGO_W = 1.15;
const PPT_BODY_PT = 19;
const PPT_BODY_LINE_IN = 0.32;

export function sanitizeExportFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Turn AI "PPT Slide Content" text into multiple slides.
 * Supports: Slide N: titles, ## headings, --- dividers, or length-based chunking.
 */
export function parsePptContentIntoSlides(raw: string): { title: string; body: string }[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [{ title: "Slide 1", body: "" }];

  const slideStarts = text.split(/\n(?=\s*Slide\s*\d+\s*[:\.\-–]?\s+)/i);
  if (slideStarts.length > 1 || /^\s*Slide\s*\d+/i.test(slideStarts[0])) {
    return slideStarts.map((segment, idx) => {
      const seg = segment.trim();
      const lines = seg.split("\n");
      const first = lines[0] ?? "";
      const titleFromFirst = first.replace(/^\s*Slide\s*\d+\s*[:\.\-–]?\s*/i, "").trim();
      const title =
        titleFromFirst.length > 0 && titleFromFirst.length < 120
          ? titleFromFirst
          : `Slide ${idx + 1}`;
      const bodyLines = titleFromFirst.length > 0 && titleFromFirst.length < 120 ? lines.slice(1) : lines;
      const body = bodyLines.join("\n").trim() || seg.replace(/^\s*Slide\s*\d+\s*[:\.\-–]?\s*/i, "").trim();
      return { title: title.slice(0, 120), body: body || "(Content on this slide.)" };
    });
  }

  const hashSplit = text.split(/\n(?=#{1,3}\s+)/);
  if (hashSplit.length > 1) {
    return hashSplit.map((block, idx) => {
      const m = block.match(/^#+\s*(.+)$/m);
      const title = (m?.[1]?.trim() || `Section ${idx + 1}`).slice(0, 120);
      const body = block.replace(/^#+\s*.+$/m, "").trim() || block.trim();
      return { title, body };
    });
  }

  const ruleSplit = text.split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean);
  if (ruleSplit.length > 1) {
    return ruleSplit.map((block, idx) => {
      const lines = block.split("\n");
      const candidate = lines[0]?.trim() ?? `Section ${idx + 1}`;
      const useFirstAsTitle = candidate.length > 0 && candidate.length < 100;
      const title = useFirstAsTitle ? candidate.slice(0, 120) : `Section ${idx + 1}`;
      const body = useFirstAsTitle ? lines.slice(1).join("\n").trim() : block;
      return { title, body: body || block };
    });
  }

  const maxLen = 950;
  if (text.length <= maxLen) {
    return [{ title: "Presentation", body: text }];
  }

  const slides: { title: string; body: string }[] = [];
  let pos = 0;
  let n = 1;
  while (pos < text.length) {
    let end = Math.min(text.length, pos + maxLen);
    let chunk = text.slice(pos, end);
    if (end < text.length) {
      const br = chunk.lastIndexOf("\n\n");
      if (br > 280) {
        chunk = chunk.slice(0, br);
        end = pos + br;
      }
    }
    slides.push({ title: `Slide ${n}`, body: chunk.trim() });
    pos += chunk.length;
    n += 1;
  }
  return slides;
}

export async function buildDocxBuffer(params: {
  documentTitle: string;
  subject: string;
  grade: string;
  topic: string;
  content: string;
}): Promise<Buffer> {
  const metaParagraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: params.documentTitle,
          bold: true,
          size: 36,
          color: "1A1A2E",
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${params.subject}  ·  ${params.grade}  ·  ${params.topic}`,
          italics: true,
          size: 20,
          color: "555577",
        }),
      ],
      spacing: { after: 320 },
    }),
  ];

  const contentParagraphs = parseMarkdownContentToDocxParagraphs(params.content);

  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          run: { bold: true, size: 32, color: "1A1A2E" },
          paragraph: { spacing: { before: 260, after: 120 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          run: { bold: true, size: 26, color: "2C3E80" },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          run: { bold: true, size: 22, color: "34495E" },
          paragraph: { spacing: { before: 160, after: 60 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 900,
              bottom: 720,
              left: 900,
            },
          },
        },
        children: [...metaParagraphs, ...contentParagraphs],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

/** Parse inline markdown segments (**bold**, *italic*, `code`) into TextRun array. */
function parseInlineMarkdown(text: string, baseSizePt = 24): TextRun[] {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*[-─━═]{3,}\s*$/, "");

  const runs: TextRun[] = [];
  // Match **bold**, *italic*, or `code`
  const re = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    if (m.index > last) {
      const plain = cleaned.slice(last, m.index).replace(/[*#_`~|\\]/g, "");
      if (plain) runs.push(new TextRun({ text: plain, size: baseSizePt }));
    }
    if (m[2] !== undefined) {
      runs.push(new TextRun({ text: m[2], bold: true, size: baseSizePt }));
    } else if (m[3] !== undefined) {
      runs.push(new TextRun({ text: m[3], italics: true, size: baseSizePt }));
    } else if (m[4] !== undefined) {
      runs.push(new TextRun({ text: m[4], font: "Courier New", size: baseSizePt - 2 }));
    }
    last = m.index + m[0].length;
  }
  if (last < cleaned.length) {
    const plain = cleaned.slice(last).replace(/[*#_`~|\\]/g, "");
    if (plain) runs.push(new TextRun({ text: plain, size: baseSizePt }));
  }
  return runs.length > 0 ? runs : [new TextRun({ text: cleaned.replace(/[*#_`~|\\]/g, ""), size: baseSizePt })];
}

/** Convert markdown content string into a list of docx Paragraph objects with proper formatting. */
function parseMarkdownContentToDocxParagraphs(content: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const rawLines = content.replace(/\r\n/g, "\n").split("\n");
  let inCodeBlock = false;

  for (const rawLine of rawLines) {
    // Code fence toggle — skip rendering code fence lines
    if (rawLine.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: rawLine, font: "Courier New", size: 20, color: "333333" })],
          spacing: { after: 40 },
          indent: { left: 480 },
        }),
      );
      continue;
    }

    const trimmed = rawLine.trim();

    // Blank line → spacing gap
    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    // Divider line (─── / --- / ═══ / ===)
    if (/^[-─━═=]{3,}\s*$/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "────────────────────────────────────────────────────────",
              color: "BBBBBB",
              size: 18,
            }),
          ],
          spacing: { before: 140, after: 140 },
        }),
      );
      continue;
    }

    // H1: # Heading
    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineMarkdown(h1[1]!, 32),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 280, after: 120 },
        }),
      );
      continue;
    }

    // H2: ## Heading
    const h2 = trimmed.match(/^#{2}\s+(.+)$/);
    if (h2) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineMarkdown(h2[1]!, 26),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 220, after: 80 },
        }),
      );
      continue;
    }

    // H3/H4+: ### Heading
    const h3 = trimmed.match(/^#{3,}\s+(.+)$/);
    if (h3) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineMarkdown(h3[1]!, 22),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 60 },
        }),
      );
      continue;
    }

    // Unordered bullet: - item or * item or • item
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      const runs = parseInlineMarkdown(bullet[1]!, 24);
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: "•  ", bold: true, size: 24, color: "2C3E80" }), ...runs],
          indent: { left: 360, hanging: 0 },
          spacing: { after: 60 },
        }),
      );
      continue;
    }

    // Numbered list: 1. item or 1) item
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      const runs = parseInlineMarkdown(numbered[2]!, 24);
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${numbered[1]}.  `, bold: true, size: 24, color: "2C3E80" }),
            ...runs,
          ],
          indent: { left: 360, hanging: 0 },
          spacing: { after: 60 },
        }),
      );
      continue;
    }

    // Checkbox / can-do statement: [ ] text or [x] text
    const checkbox = trimmed.match(/^\[([x ])\]\s+(.+)$/i);
    if (checkbox) {
      const checked = checkbox[1]?.toLowerCase() === "x";
      const runs = parseInlineMarkdown(checkbox[2]!, 24);
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: checked ? "☑  " : "☐  ", size: 24, color: "2C3E80" }),
            ...runs,
          ],
          indent: { left: 360 },
          spacing: { after: 60 },
        }),
      );
      continue;
    }

    // Normal paragraph
    const runs = parseInlineMarkdown(trimmed, 24);
    paragraphs.push(
      new Paragraph({
        children: runs,
        spacing: { after: 80 },
      }),
    );
  }

  return paragraphs;
}

/** Shared markdown → docx paragraphs (lesson plans, question papers, etc.). */
export function markdownToDocxParagraphs(content: string): Paragraph[] {
  return parseMarkdownContentToDocxParagraphs(content);
}

let layahLogoDataUriCache: string | null | undefined;

/** Brand logo from `public/Logo.png` (or `logo.png`) for PPT footers. */
async function loadLayahLogoDataUri(): Promise<string | null> {
  if (layahLogoDataUriCache !== undefined) return layahLogoDataUriCache;
  for (const fileName of ["Logo.png", "logo.png"]) {
    try {
      const logoPath = path.join(process.cwd(), "public", fileName);
      const buf = await readFile(logoPath);
      layahLogoDataUriCache = `data:image/png;base64,${buf.toString("base64")}`;
      return layahLogoDataUriCache;
    } catch {
      /* try next filename */
    }
  }
  console.warn("[pptx] Layah logo not found in public/Logo.png");
  layahLogoDataUriCache = null;
  return null;
}

/** Currently unused (kept for a future call site) — routed through the same
 *  SSRF-guarded fetch as the live image path in ppt-template-engine.ts so it
 *  can't become an unguarded external-fetch footgun if it's wired up later. */
async function fetchImageUrlAsDataUri(url: string): Promise<string> {
  const buf = await fetchExternalImageSafely(url);
  const sniffed = sniffFileSignature(buf);
  const mime =
    sniffed === "jpeg" ? "image/jpeg" :
    sniffed === "webp" ? "image/webp" :
    sniffed === "gif" ? "image/gif" :
    "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function stripInlineMarkdownFromSegment(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/** Remove stray markdown symbols (including # * _ ` |) after structural cleanup. */
function stripResidualMarkdownSymbols(line: string): string {
  return line.replace(/[*#_`|]/g, "").replace(/\s+/g, " ").trim();
}

function cleanSlideTitle(title: string): string {
  const t = stripInlineMarkdownFromSegment(title.replace(/\r\n/g, " "))
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\s*(?:[-*+]|(?:\d+[.)]))\s+/, "")
    .replace(/^\s*-\s+/, "");
  return stripResidualMarkdownSymbols(t || "Slide").slice(0, 120) || "Slide";
}

/** One emoji icon per 0-based deck position (13 slides). Used in slide title headers. */
const SLIDE_ICONS_BY_INDEX: readonly string[] = [
  "🎓", // 0 – Subject / Grade / Date
  "🎯", // 1 – Starter Activity
  "📚", // 2 – Chapter, Topic and SDG Goal
  "🎯", // 3 – Learning Objectives
  "✅", // 4 – Learning Outcomes
  "📖", // 5 – Main Phase Core Teaching
  "🎨", // 6 – Differentiated Activity and Mini Plenary
  "🌍", // 7 – UAE / Real-Life Connection
  "🏆", // 8 – Plenary
  "🏠", // 9 – Extended Task
  "🎫", // 10 – Exit Ticket
  "⭐", // 11 – Success Criteria and Self Evaluation
  "👏", // 12 – Thank You
] as const;

function slideTitleWithIcon(titleBase: string, deckIndex: number): string {
  const icon = SLIDE_ICONS_BY_INDEX[deckIndex];
  return icon ? `${icon}  ${titleBase}` : titleBase;
}

/**
 * Turn slide body into plain bullet lines: preserves paragraphs as separate lines,
 * strips markdown list markers (including hyphen bullets), and removes markdown symbols.
 */
function normalizeBodyToBulletLines(body: string): string[] {
  const text = body.replace(/\r\n/g, "\n");
  const withoutFences = text.replace(/```[\s\S]*?```/g, "\n");
  const rawLines = withoutFences.split("\n");
  const out: string[] = [];
  for (const raw of rawLines) {
    let line = raw.trim();
    if (!line) continue;
    line = line.replace(/^#{1,6}\s+/, "");
    line = line.replace(/^\s*(?:[-*+]|(?:\d+[.)]))\s+/, "");
    line = line.replace(/^\s*-\s+/, "");
    line = stripInlineMarkdownFromSegment(line);
    line = stripResidualMarkdownSymbols(line);
    if (line) out.push(line);
  }
  return out.length > 0 ? out : ["(No content provided)"];
}

function charsPerLineForTextWidth(textWidthInches: number): number {
  return Math.max(28, Math.floor(textWidthInches * 7.6));
}

function estimateWrappedLines(line: string, charsPerLine: number): number {
  if (!line.length) return 1;
  return Math.max(1, Math.ceil(line.length / charsPerLine));
}

/** Split a single long line into smaller lines so each fits roughly within `maxChars` characters. */
function splitLongLineIntoSegments(line: string, maxChars: number): string[] {
  const limit = Math.max(24, maxChars);
  if (line.length <= limit) return [line];
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    const parts: string[] = [];
    for (let i = 0; i < line.length; i += limit) {
      parts.push(line.slice(i, i + limit).trim());
    }
    return parts.filter(Boolean);
  }
  const segments: string[] = [];
  let buf = "";
  for (const w of words) {
    const next = buf ? `${buf} ${w}` : w;
    if (next.length > limit && buf) {
      segments.push(buf);
      buf = w;
    } else {
      buf = next;
    }
  }
  if (buf) segments.push(buf);
  return segments.length ? segments : [line.slice(0, limit)];
}

function expandOverlongLines(lines: string[], charsPerLine: number, maxVisualRows: number): string[] {
  const maxCharsPerSegment = Math.max(32, Math.floor(charsPerLine * Math.min(maxVisualRows, 14) * 0.9));
  const expanded: string[] = [];
  for (const line of lines) {
    const est = estimateWrappedLines(line, charsPerLine);
    if (est <= maxVisualRows) {
      expanded.push(line);
      continue;
    }
    expanded.push(...splitLongLineIntoSegments(line, maxCharsPerSegment));
  }
  return expanded;
}

/**
 * Pre-compute how many physical slides the deck will render to (title + all overflow chunks).
 * Used to show "Slide X of N" in footers before rendering starts.
 */
function computeTotalSlideCount(deck: StructuredLessonSlideModel[]): number {
  // Slide 0 (title) always renders as exactly 1 physical slide
  let total = 1;
  for (let i = 1; i < deck.length; i++) {
    const model = deck[i]!;
    const L = layoutContentMetrics(model.includeImageSlot);
    const bulletLines = normalizeBodyToBulletLines(model.body);
    const chunks = chunkBulletLines(bulletLines, L.textW, maxBodyRows(L.contentMaxH));
    total += Math.max(1, chunks.length);
  }
  return total;
}

function chunkBulletLines(
  lines: string[],
  textWidthInches: number,
  maxVisualRows: number,
): string[][] {
  const cpl = charsPerLineForTextWidth(textWidthInches);
  const maxRows = Math.max(4, maxVisualRows);
  const linesExpanded = expandOverlongLines(lines, cpl, maxRows);
  const chunks: string[][] = [];
  let current: string[] = [];
  let usedRows = 0;
  for (const line of linesExpanded) {
    const est = estimateWrappedLines(line, cpl);
    if (usedRows + est > maxVisualRows && current.length > 0) {
      chunks.push(current);
      current = [];
      usedRows = 0;
    }
    current.push(line);
    usedRows += est;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks.length > 0 ? chunks : [["(No content provided)"]];
}

function layoutInnerLeft(): number {
  return IN_MARGIN + PPT_LEFT_ACCENT_W + 0.06;
}

function layoutContentMetrics(hasImage: boolean): {
  titleX: number;
  titleW: number;
  metaY: number;
  contentTop: number;
  contentMaxH: number;
  textX: number;
  textW: number;
  imgX: number;
  imgY: number;
  imgW: number;
  imgH: number;
} {
  const innerLeft = layoutInnerLeft();
  const titleY = IN_MARGIN + PPT_TOP_BAR_H + 0.05;
  const metaY = titleY + PPT_TITLE_H + 0.05;
  const contentTop = metaY + PPT_META_H + 0.08;
  const footerTop = IN_SLIDE_H - IN_MARGIN - PPT_FOOTER_BLOCK;
  const contentBottom = footerTop - 0.08;
  const contentMaxH = Math.max(2.2, contentBottom - contentTop);

  const imgW = PPT_IMG_W;
  const imgX = IN_SLIDE_W - IN_MARGIN - imgW;
  const textW = hasImage ? Math.max(3.5, imgX - PPT_COL_GAP - innerLeft) : IN_SLIDE_W - innerLeft - IN_MARGIN;

  return {
    titleX: innerLeft,
    titleW: IN_SLIDE_W - innerLeft - IN_MARGIN,
    metaY,
    contentTop,
    contentMaxH,
    textX: innerLeft,
    textW,
    imgX,
    imgY: contentTop,
    imgW,
    imgH: contentMaxH,
  };
}

function maxBodyRows(contentMaxH: number): number {
  return Math.max(4, Math.floor(contentMaxH / PPT_BODY_LINE_IN));
}

function toAccentRuns(
  line: string,
  theme: PptRenderTheme,
): Array<{ text: string; options: Record<string, unknown> }> {
  const ff = theme.fontFace ?? "Calibri";
  const normalized = line.replace(/^\u2022\s*/, "").trim();
  const baseBody = { color: theme.bodyText, fontFace: ff, fontSize: PPT_BODY_PT };
  if (!normalized) {
    return [{ text: "\u2022 ", options: { ...baseBody } }];
  }
  const colon = normalized.indexOf(":");
  if (colon > 1 && colon < 52) {
    return [
      { text: "\u2022 ", options: { ...baseBody } },
      {
        text: `${normalized.slice(0, colon)}: `,
        options: {
          color: theme.bodyAccent,
          bold: true,
          fontFace: ff,
          fontSize: PPT_BODY_PT,
        },
      },
      {
        text: normalized.slice(colon + 1).trim(),
        options: { ...baseBody },
      },
    ];
  }
  return [{ text: `\u2022 ${normalized}`, options: { ...baseBody } }];
}

function addSlideFooter(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  theme: PptRenderTheme,
  subject: string,
  grade: string,
  slideNumberText: string,
  layahLogoDataUri?: string | null,
) {
  const ff = theme.fontFace ?? "Calibri";
  const lineY = IN_SLIDE_H - IN_MARGIN - 0.22;
  const logoY = lineY + 0.03;
  const subjectX = IN_MARGIN + (layahLogoDataUri ? PPT_LAYAH_LOGO_W + 0.14 : 0.02);

  slide.addShape(pptx.ShapeType.line, {
    x: IN_MARGIN,
    y: lineY,
    w: IN_SLIDE_W - 2 * IN_MARGIN,
    h: 0,
    line: { color: theme.footerLine, pt: 1 },
  });

  if (layahLogoDataUri) {
    slide.addImage({
      data: layahLogoDataUri,
      x: IN_MARGIN,
      y: logoY,
      w: PPT_LAYAH_LOGO_W,
      h: PPT_LAYAH_LOGO_H,
      altText: "Layah",
    });
  }

  slide.addText(subject.trim(), {
    x: subjectX,
    y: lineY + 0.04,
    w: Math.max(3, IN_SLIDE_W - IN_MARGIN - subjectX - 2.4),
    h: 0.22,
    fontSize: 14,
    color: theme.footerText,
    fontFace: ff,
  });
  slide.addText(slideNumberText, {
    x: IN_SLIDE_W - IN_MARGIN - 2.1,
    y: lineY + 0.04,
    w: 1.9,
    h: 0.22,
    fontSize: 14,
    color: theme.footerText,
    fontFace: ff,
    align: "right",
  });
}

function normalizeDeckImageUrls(
  deckLen: number,
  urls: (string | null)[] | null | undefined,
): (string | null)[] {
  const out: (string | null)[] = Array.from({ length: deckLen }, () => null);
  if (!urls) return out;
  for (let i = 0; i < Math.min(deckLen, urls.length); i++) {
    out[i] = urls[i] ?? null;
  }
  return out;
}

function addImagePlaceholder(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  theme: PptRenderTheme,
  box: { x: number; y: number; w: number; h: number },
) {
  const pad = 0.08;
  slide.addShape(pptx.ShapeType.rect, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fill: { color: theme.placeholderFill },
    line: { color: theme.placeholderLine, pt: 1 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: box.x + box.w * 0.28,
    y: box.y + box.h * 0.28,
    w: box.w * 0.44,
    h: box.h * 0.22,
    fill: { color: theme.placeholderInner },
    line: { color: theme.placeholderLine, pt: 0.5 },
  });
  slide.addText("Image unavailable", {
    x: box.x + pad,
    y: box.y + box.h * 0.62,
    w: box.w - 2 * pad,
    h: 0.28,
    fontSize: 13,
    color: theme.footerText,
    fontFace: theme.fontFace ?? "Calibri",
    align: "center",
  });
}

/** Add a small school logo image to the top-right corner of a slide. */
function addLogoToSlide(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  logoDataUri: string,
  isHeroSlide = false,
) {
  const logoW = 1.85;
  const logoH = 0.38;
  const logoX = 13.333333 - 0.3 - logoW; // right-aligned with margin
  const logoY = isHeroSlide ? 0.12 : 0.26; // slightly higher on hero slides

  // White semi-transparent backing so logo is visible on any colour
  slide.addShape(pptx.ShapeType.rect, {
    x: logoX - 0.05,
    y: logoY - 0.04,
    w: logoW + 0.1,
    h: logoH + 0.08,
    fill: { color: "FFFFFF", transparency: 20 },
    line: { color: "FFFFFF", transparency: 60, pt: 0.5 },
  });
  slide.addImage({
    data: logoDataUri,
    x: logoX,
    y: logoY,
    w: logoW,
    h: logoH,
    altText: "School logo",
  });
}

/**
 * Expected keyword that must appear in each deck slide's title (0-indexed).
 * Used for canonical-order validation and to log any mismatches before rendering.
 * Slide 7 (Real Life) matches both UAE and non-UAE title variants via "real life" OR "uae".
 */
const CANONICAL_TITLE_KEYWORDS: readonly [index: number, keyword: string, label: string][] = [
  [0,  "grade",         "Title / Subject Grade Date"],
  [1,  "starter",       "Starter Activity"],
  [2,  "chapter",       "Chapter Topic SDG Goal"],
  [3,  "objectives",    "Learning Objectives"],
  [4,  "outcomes",      "Learning Outcomes"],
  [5,  "main phase",    "Main Phase Core Teaching"],
  [6,  "differentiated","Differentiated Activity and Mini Plenary"],
  [7,  "real life",     "Real Life / UAE Connection"],
  [8,  "plenary",       "Plenary"],
  [9,  "extended",      "Extended Task"],
  [10, "exit",          "Exit Ticket"],
  [11, "success",       "Success Criteria and Self Evaluation"],
  [12, "thank",         "Thank You"],
];

/** Slide 7 may have either UAE or non-UAE title — both are valid. */
const SLIDE7_ALT_KEYWORD = "uae";

/**
 * Build a map from lowercase slide title → image URL.
 * Using the title (name) rather than the array position means content is correctly
 * identified even if the deck order were ever to shift.
 */
function buildSlideUrlByTitle(
  deck: StructuredLessonSlideModel[],
  imageUrls: (string | null)[] | null | undefined,
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (let i = 0; i < deck.length; i++) {
    const title = (deck[i]?.slideTitle ?? "").trim().toLowerCase();
    if (title) {
      map.set(title, imageUrls?.[i] ?? null);
    }
  }
  return map;
}

/**
 * Validate that each deck slide's title contains the expected canonical keyword.
 * Logs a warning for any mismatch — does not throw.
 */
function validateDeckCanonicalOrder(deck: StructuredLessonSlideModel[]): void {
  for (const [idx, keyword, label] of CANONICAL_TITLE_KEYWORDS) {
    const title = (deck[idx]?.slideTitle ?? "").toLowerCase();
    const alt = idx === 7 ? SLIDE7_ALT_KEYWORD : null;
    if (!title.includes(keyword) && !(alt && title.includes(alt))) {
      console.warn(
        `[pptx] Deck position ${idx} title mismatch — expected keyword "${keyword}" for "${label}", got "${deck[idx]?.slideTitle ?? "(missing)"}"`,
      );
    }
  }
}

/**
 * Log the full content-assignment table showing which named content maps to which
 * physical slides (including overflow continuation slides).
 */
function logContentAssignmentTable(
  deck: StructuredLessonSlideModel[],
  slideUrlByTitle: Map<string, string | null>,
  totalSlides: number,
): void {
  console.log(`[pptx] Content assignment by name (${deck.length} model slides → ${totalSlides} physical slides):`);
  for (let i = 0; i < deck.length; i++) {
    const model = deck[i]!;
    const L = layoutContentMetrics(model.includeImageSlot);
    const bulletLines = normalizeBodyToBulletLines(model.body);
    const chunks = chunkBulletLines(bulletLines, L.textW, maxBodyRows(L.contentMaxH));
    const hasUrl = Boolean(slideUrlByTitle.get(model.slideTitle.trim().toLowerCase()));
    const overflow = chunks.length > 1 ? ` → ${chunks.length} physical slides (overflow)` : "";
    console.log(`  [${i}] "${model.slideTitle}" | imageUrl:${hasUrl}${overflow}`);
  }
}

export async function buildPptxFromPptContent(params: {
  subject: string;
  grade: string;
  topic: string;
  pptContent: string;
  teacherName?: string;
  fullLessonPlan?: string;
  learningObjectives?: string;
  homeworkTask?: string;
  /** When set, skips rebuilding slide models from text fields. */
  structuredSlides?: StructuredLessonSlideModel[];
  /** Parallel to structured deck (before chunking): URL per deck index for slides that use images. */
  slideImageUrls?: (string | null)[] | null;
  themeId?: PptThemeId;
  /** When structuredSlides omitted, these are merged into the slide builder context. */
  aflSelections?: AflSelectionsPayload;
  curriculumFramework?: string;
  /** When set, overrides themeId with colors extracted from the school's .pptx template. */
  customRenderTheme?: PptRenderTheme;
  /** Base64 data URI of the school logo extracted from the .pptx template. */
  schoolLogo?: string | null;
}): Promise<Buffer> {
  const afl = sanitizeAflSelections(params.aflSelections ?? {});
  if (Object.keys(afl).length > 0) {
    console.log("[lesson-plan-export] buildPptxFromPptContent received AFL selections:", afl);
  }
  const ctx = {
    subject: params.subject.trim(),
    grade: params.grade.trim(),
    topic: params.topic.trim(),
    teacherName: (params.teacherName || "Teacher").trim() || "Teacher",
    learningObjectivesText: params.learningObjectives?.trim(),
    fullLessonPlan: params.fullLessonPlan?.trim(),
    pptContent: (params.pptContent || "").trim(),
    homeworkTask: params.homeworkTask?.trim(),
    ...(params.curriculumFramework?.trim()
      ? { curriculumFramework: params.curriculumFramework.trim() }
      : {}),
    ...(Object.keys(afl).length > 0 ? { aflSelections: afl } : {}),
  };
  const deck = params.structuredSlides ?? buildStructuredLessonSlides(ctx);

  // Delegate all rendering to the template engine — it handles layout, images, overflow, and footer.
  return buildPptxFromTemplateEngine({
    templateId: params.themeId ?? DEFAULT_PPT_THEME_ID,
    slides: deck,
    subject: params.subject.trim(),
    grade: params.grade.trim(),
    topic: params.topic.trim(),
    teacherName: params.teacherName,
    slideImageUrls: params.slideImageUrls,
    schoolLogo: params.schoolLogo,
  });
}

export async function buildTeacherPackageZipBuffer(params: {
  subject: string;
  grade: string;
  topic: string;
  lessonPlan: LessonPlanResult;
  aflSelections?: AflSelectionsPayload;
}): Promise<Buffer> {
  const { planTextOnly, pptSlideImageUrls } = parseSectionImagesMeta(params.lessonPlan);
  const lessonPlan = planTextOnly;

  const base = sanitizeExportFileName(`${params.grade}-${params.subject}-${params.topic}`) || "teacher-package";
  const meta = {
    subject: params.subject,
    grade: params.grade,
    topic: params.topic,
  };
  const afl = sanitizeAflSelections(params.aflSelections ?? {});
  const aflDocAppendix = formatDocxAflAppendix(afl);

  const zip = new JSZip();

  const ctx = buildLessonPlanContextFromResult(lessonPlan, {
    subject: meta.subject,
    grade: meta.grade,
    topic: meta.topic,
    teacherName: "Teacher",
    ...(lessonPlan.curriculum_framework?.trim()
      ? { curriculumFramework: lessonPlan.curriculum_framework.trim() }
      : {}),
    ...(Object.keys(afl).length > 0 ? { aflSelections: afl } : {}),
  });
  const pptOutline = getPptSourceSlideOutline(lessonPlan).trim();
  const fullForDeck = (ctx.fullLessonPlan ?? "").trim();
  if (pptOutline.length > 0 || fullForDeck.length > 0) {
    const structuredSlides = buildStructuredLessonSlides(ctx);
    const slideUrls =
      pptSlideImageUrls && pptSlideImageUrls.length >= structuredSlides.length
        ? pptSlideImageUrls.slice(0, structuredSlides.length)
        : null;

    zip.file(
      `${base}-ppt-content.pptx`,
      await buildPptxFromPptContent({
        ...meta,
        pptContent: pptOutline || fullForDeck.slice(0, 1200),
        fullLessonPlan: ctx.fullLessonPlan,
        learningObjectives: ctx.learningObjectivesText,
        homeworkTask: ctx.homeworkTask,
        teacherName: ctx.teacherName,
        themeId: DEFAULT_PPT_THEME_ID,
        structuredSlides,
        slideImageUrls: slideUrls,
      }),
    );
  }

  const docxParts: { file: string; title: string; key: (typeof TEACHER_PACKAGE_SECTIONS)[number] }[] = [
    { file: `${base}-lesson-plan.docx`, title: "Lesson Plan", key: "Full Lesson Plan" },
    { file: `${base}-worksheet.docx`, title: "Worksheet", key: "Worksheet" },
    { file: `${base}-assessment.docx`, title: "Assessment Questions", key: "Assessment Questions" },
    { file: `${base}-homework.docx`, title: "Homework", key: "Homework Task" },
    { file: `${base}-teacher-notes.docx`, title: "Teacher Notes", key: "Teacher Notes" },
    { file: `${base}-afl-activity-sheets.docx`, title: "Activity Sheet AFL", key: "AFL Activity Sheets" },
  ];

  for (const part of docxParts) {
    const raw = lessonPlan[part.key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      const withAfl =
        part.key === "Full Lesson Plan" && aflDocAppendix ? `${raw}${aflDocAppendix}` : raw;
      zip.file(
        part.file,
        await buildDocxBuffer({
          documentTitle: part.title,
          ...meta,
          content: withAfl,
        }),
      );
    }
  }

  if (Object.keys(zip.files).length === 0) {
    throw new Error("No exportable teacher-package sections in lesson plan.");
  }

  return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
