import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import {
  buildLessonPlanContextFromResult,
  buildStructuredLessonSlides,
  type StructuredLessonSlideModel,
} from "@/lib/ppt-structured-lesson";
import { formatDocxAflAppendix, sanitizeAflSelections, type AflSelectionsPayload } from "@/lib/afl-tools";
import {
  getPptSourceSlideOutline,
  TEACHER_PACKAGE_SECTIONS,
  type LessonPlanResult,
} from "@/lib/lesson-plan";
import {
  DEFAULT_PPT_THEME_ID,
  type PptRenderTheme,
  type PptThemeId,
  getPptRenderTheme,
} from "@/lib/ppt-themes";

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
  const children: Paragraph[] = [
    new Paragraph({
      text: params.documentTitle,
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${params.subject} · ${params.grade} · ${params.topic}`,
          italics: true,
          size: 22,
        }),
      ],
      spacing: { after: 240 },
    }),
  ];

  const lines = params.content.length > 0 ? params.content.split("\n") : [" "];
  for (const line of lines) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: line.length ? line : " ", size: 24 })],
        spacing: { after: 80 },
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

async function fetchImageUrlAsDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching image`);
  }
  const mimeRaw = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const mime = mimeRaw.startsWith("image/") ? mimeRaw : "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
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
  const normalized = line.replace(/^\u2022\s*/, "").trim();
  const baseBody = { color: theme.bodyText, fontFace: "Calibri", fontSize: PPT_BODY_PT };
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
          fontFace: "Calibri",
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
) {
  const lineY = IN_SLIDE_H - IN_MARGIN - 0.22;
  slide.addShape(pptx.ShapeType.line, {
    x: IN_MARGIN,
    y: lineY,
    w: IN_SLIDE_W - 2 * IN_MARGIN,
    h: 0,
    line: { color: theme.footerLine, pt: 1 },
  });
  slide.addText(`${subject} · ${grade}`, {
    x: IN_MARGIN + 0.02,
    y: lineY + 0.04,
    w: 8.5,
    h: 0.22,
    fontSize: 14,
    color: theme.footerText,
    fontFace: "Calibri",
  });
  slide.addText(slideNumberText, {
    x: IN_SLIDE_W - IN_MARGIN - 2.1,
    y: lineY + 0.04,
    w: 1.9,
    h: 0.22,
    fontSize: 14,
    color: theme.footerText,
    fontFace: "Calibri",
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
    fontFace: "Calibri",
    align: "center",
  });
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
  /** Parallel to structured deck: URL only for slides that use images (title, main teaching, group, plenary). */
  slideImageUrls?: (string | null)[] | null;
  themeId?: PptThemeId;
  /** When structuredSlides omitted, these are merged into the slide builder context. */
  aflSelections?: AflSelectionsPayload;
}): Promise<Buffer> {
  const theme = getPptRenderTheme(params.themeId);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "EduPlan AI";
  pptx.company = "EduPlan AI";
  pptx.subject = `${params.subject} — ${params.topic}`;
  pptx.title = `Slides — ${params.topic}`;

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
    ...(Object.keys(afl).length > 0 ? { aflSelections: afl } : {}),
  };
  const deck = params.structuredSlides ?? buildStructuredLessonSlides(ctx);
  const slideUrls = normalizeDeckImageUrls(deck.length, params.slideImageUrls);

  let slideNumber = 1;
  const innerPadX = IN_MARGIN + 0.85;

  const titleModel = deck[0]!;
  const titleRemote = slideUrls[0] ?? null;
  let titleImgData: string | null = null;
  if (titleRemote) {
    try {
      titleImgData = await fetchImageUrlAsDataUri(titleRemote);
    } catch (e) {
      console.warn("[pptx] could not embed title slide image", e);
    }
  }

  const titleSlide = pptx.addSlide();
  if (titleImgData) {
    titleSlide.background = { color: theme.heroDeep };
    titleSlide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: IN_SLIDE_W,
      h: IN_SLIDE_H,
      fill: { color: theme.heroMid, transparency: 16 },
      line: { color: theme.heroMid, transparency: 100 },
    });
    const textColW = 7.15;
    titleSlide.addText(cleanSlideTitle(params.topic), {
      x: IN_MARGIN,
      y: 1.05,
      w: textColW - IN_MARGIN,
      h: 1.05,
      fontSize: 34,
      bold: true,
      color: theme.heroTitle,
      fontFace: "Calibri",
      valign: "top",
      fit: "shrink",
    });
    titleSlide.addText(titleModel.body, {
      x: IN_MARGIN,
      y: 2.2,
      w: textColW - IN_MARGIN,
      h: 4.35,
      fontSize: 15,
      color: theme.heroSubtitle,
      fontFace: "Calibri",
      valign: "top",
      fit: "shrink",
    });
    titleSlide.addText("Classroom presentation", {
      x: IN_MARGIN,
      y: 6.55,
      w: textColW - IN_MARGIN,
      h: 0.35,
      fontSize: 14,
      color: theme.heroFooter,
      fontFace: "Calibri",
    });
    const ix = textColW + 0.12;
    const iw = IN_SLIDE_W - IN_MARGIN - ix;
    const ih = 5.35;
    const iy = 1.05;
    titleSlide.addShape(pptx.ShapeType.rect, {
      x: ix,
      y: iy,
      w: iw,
      h: ih,
      fill: { color: theme.imagePanelFill, transparency: 10 },
      line: { color: theme.imagePanelLine, pt: 1 },
    });
    titleSlide.addImage({
      data: titleImgData,
      x: ix + 0.08,
      y: iy + 0.08,
      w: iw - 0.16,
      h: ih - 0.16,
      altText: "Topic illustration for title slide",
    });
  } else {
    titleSlide.background = { color: theme.heroDeep };
    titleSlide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: IN_SLIDE_W,
      h: IN_SLIDE_H,
      fill: { color: theme.heroMid, transparency: 14 },
      line: { color: theme.heroMid, transparency: 100 },
    });
    titleSlide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: IN_SLIDE_W,
      h: 3.05,
      fill: { color: theme.heroWash, transparency: 18 },
      line: { color: theme.heroWash, transparency: 100 },
    });
    titleSlide.addShape(pptx.ShapeType.line, {
      x: IN_MARGIN + 1.2,
      y: 4.65,
      w: IN_SLIDE_W - 2 * IN_MARGIN - 2.4,
      h: 0,
      line: { color: theme.heroAccentLine, pt: 2.5 },
    });
    titleSlide.addText(cleanSlideTitle(params.topic), {
      x: innerPadX,
      y: 1.85,
      w: IN_SLIDE_W - 2 * innerPadX,
      h: 1.0,
      fontSize: 38,
      bold: true,
      color: theme.heroTitle,
      fontFace: "Calibri",
      align: "center",
      fit: "shrink",
    });
    titleSlide.addText(titleModel.body, {
      x: innerPadX,
      y: 2.95,
      w: IN_SLIDE_W - 2 * innerPadX,
      h: 2.2,
      fontSize: 16,
      color: theme.heroSubtitle,
      fontFace: "Calibri",
      align: "center",
      valign: "top",
      fit: "shrink",
    });
    titleSlide.addText("Classroom presentation", {
      x: innerPadX,
      y: 5.25,
      w: IN_SLIDE_W - 2 * innerPadX,
      h: 0.45,
      fontSize: 17,
      color: theme.heroSubtitle,
      fontFace: "Calibri",
      align: "center",
    });
  }

  titleSlide.addNotes(titleModel.speakerNotes);
  addSlideFooter(pptx, titleSlide, theme, params.subject, params.grade, `Slide ${slideNumber}`);
  slideNumber += 1;

  for (let slideIdx = 1; slideIdx < deck.length; slideIdx++) {
    const model = deck[slideIdx]!;
    const remoteUrl = slideUrls[slideIdx] ?? null;
    let imageDataUri: string | null = null;
    if (remoteUrl && model.includeImageSlot) {
      try {
        imageDataUri = await fetchImageUrlAsDataUri(remoteUrl);
      } catch (e) {
        console.warn("[pptx] could not embed slide image", slideIdx + 1, e);
      }
    }

    const wantSlot = model.includeImageSlot;
    const reserveImageColumn = wantSlot && Boolean(remoteUrl);
    const showPlaceholder = wantSlot && Boolean(remoteUrl) && !imageDataUri;

    const titleBase = cleanSlideTitle(model.slideTitle);
    const bulletLines = normalizeBodyToBulletLines(model.body);
    const layoutForChunking = layoutContentMetrics(reserveImageColumn);
    const chunks = chunkBulletLines(
      bulletLines,
      layoutForChunking.textW,
      maxBodyRows(layoutForChunking.contentMaxH),
    );

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx]!;
      const useImageColumn = reserveImageColumn && chunkIdx === 0;
      const L = layoutContentMetrics(useImageColumn);
      const titleText = chunkIdx > 0 ? `${titleBase} (continued)` : titleBase;
      const titleY = IN_MARGIN + PPT_TOP_BAR_H + 0.05;
      const contentBottom = L.contentTop + L.contentMaxH;

      const slide = pptx.addSlide();
      slide.background = { color: theme.slideBg };

      slide.addShape(pptx.ShapeType.rect, {
        x: IN_MARGIN,
        y: IN_MARGIN,
        w: IN_SLIDE_W - 2 * IN_MARGIN,
        h: PPT_TOP_BAR_H,
        fill: { color: theme.topBar },
        line: { color: theme.topBar },
      });

      slide.addShape(pptx.ShapeType.rect, {
        x: IN_MARGIN,
        y: titleY,
        w: PPT_LEFT_ACCENT_W,
        h: Math.max(0.35, contentBottom - titleY + 0.02),
        fill: { color: theme.sideAccent, transparency: 10 },
        line: { color: theme.sideAccent, transparency: 100 },
      });

      slide.addText(titleText, {
        x: L.titleX,
        y: titleY,
        w: L.titleW,
        h: PPT_TITLE_H,
        fontSize: 30,
        bold: true,
        color: theme.titleText,
        fontFace: "Calibri",
        valign: "top",
        fit: "shrink",
      });

      slide.addShape(pptx.ShapeType.line, {
        x: L.titleX,
        y: titleY + PPT_TITLE_H + 0.03,
        w: L.titleW,
        h: 0,
        line: { color: theme.titleUnderline, pt: 2 },
      });

      slide.addText(`${params.subject} · ${params.grade}`, {
        x: L.textX,
        y: L.metaY,
        w: L.textW,
        h: PPT_META_H,
        fontSize: 14,
        color: theme.metaText,
        fontFace: "Calibri",
        valign: "top",
        fit: "shrink",
      });

      const bodyRuns: Array<{ text: string; options: Record<string, unknown> }> = [];
      for (let i = 0; i < chunk.length; i++) {
        const line = chunk[i]!;
        bodyRuns.push(...toAccentRuns(line, theme));
        if (i < chunk.length - 1) {
          bodyRuns.push({ text: "", options: { breakLine: true } });
        }
      }

      slide.addText(bodyRuns, {
        x: L.textX,
        y: L.contentTop,
        w: L.textW,
        h: L.contentMaxH,
        valign: "top",
        fit: "shrink",
      });

      const imgPad = 0.07;
      if (imageDataUri && chunkIdx === 0) {
        slide.addShape(pptx.ShapeType.rect, {
          x: L.imgX,
          y: L.imgY,
          w: L.imgW,
          h: L.imgH,
          fill: { color: theme.imagePanelFill, transparency: 8 },
          line: { color: theme.imagePanelLine, pt: 1 },
        });
        slide.addImage({
          data: imageDataUri,
          x: L.imgX + imgPad,
          y: L.imgY + imgPad,
          w: L.imgW - 2 * imgPad,
          h: L.imgH - 2 * imgPad,
          altText: "AI-generated rectangular illustration for this slide",
        });
      } else if (showPlaceholder && chunkIdx === 0) {
        addImagePlaceholder(pptx, slide, theme, {
          x: L.imgX,
          y: L.imgY,
          w: L.imgW,
          h: L.imgH,
        });
      }

      const notes =
        chunkIdx > 0
          ? `${model.speakerNotes}\n\n(Continued slide — same section.)`
          : model.speakerNotes;
      slide.addNotes(notes);
      addSlideFooter(pptx, slide, theme, params.subject, params.grade, `Slide ${slideNumber}`);
      slideNumber += 1;
    }
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

export async function buildTeacherPackageZipBuffer(params: {
  subject: string;
  grade: string;
  topic: string;
  lessonPlan: LessonPlanResult;
  aflSelections?: AflSelectionsPayload;
}): Promise<Buffer> {
  const base = sanitizeExportFileName(`${params.grade}-${params.subject}-${params.topic}`) || "teacher-package";
  const meta = {
    subject: params.subject,
    grade: params.grade,
    topic: params.topic,
  };
  const afl = sanitizeAflSelections(params.aflSelections ?? {});
  const aflDocAppendix = formatDocxAflAppendix(afl);

  const zip = new JSZip();

  const ctx = buildLessonPlanContextFromResult(params.lessonPlan, {
    subject: meta.subject,
    grade: meta.grade,
    topic: meta.topic,
    teacherName: "Teacher",
    ...(Object.keys(afl).length > 0 ? { aflSelections: afl } : {}),
  });
  const pptOutline = getPptSourceSlideOutline(params.lessonPlan).trim();
  const fullForDeck = (ctx.fullLessonPlan ?? "").trim();
  if (pptOutline.length > 0 || fullForDeck.length > 0) {
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
        structuredSlides: buildStructuredLessonSlides(ctx),
      }),
    );
  }

  const docxParts: { file: string; title: string; key: (typeof TEACHER_PACKAGE_SECTIONS)[number] }[] = [
    { file: `${base}-lesson-plan.docx`, title: "Lesson Plan", key: "Full Lesson Plan" },
    { file: `${base}-worksheet.docx`, title: "Worksheet", key: "Worksheet" },
    { file: `${base}-assessment.docx`, title: "Assessment Questions", key: "Assessment Questions" },
    { file: `${base}-homework.docx`, title: "Homework", key: "Homework Task" },
    { file: `${base}-teacher-notes.docx`, title: "Teacher Notes", key: "Teacher Notes" },
  ];

  for (const part of docxParts) {
    const raw = params.lessonPlan[part.key];
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
