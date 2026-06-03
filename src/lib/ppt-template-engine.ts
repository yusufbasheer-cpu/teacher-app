/**
 * Template-based PPT rendering engine for Layah.
 *
 * Layout contract (identical across all templates, per design spec):
 *   Header bar  — top 1.2 in, full width
 *   Content area — left 60 % (x 0.3, w 7.73)
 *   Image area   — right 35 % (x 8.67, w 4.51), 5 % gap
 *   Footer       — bottom 0.4 in: subject · logo · slide number · progress bar
 */

import { readFile } from "fs/promises";
import path from "path";
import PptxGenJS from "pptxgenjs";
import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";

// ─── JSON template types ──────────────────────────────────────────────────────

type TemplateColors = {
  accent: string;
  background: string;
  headerBar: string;
  headerText: string;
  titleSlideBackground: string;
  titleSlideTitle: string;
  titleSlideSubtitle: string;
  contentText: string;
  footerBackground: string;
  footerBorder: string;
  footerText: string;
  progressTrack: string;
  progressFill: string;
  imagePanelBackground: string;
  imagePanelBorder: string;
};

type TemplateFonts = { titleSize: number; contentSize: number; face: string };

type TitleSlideLayout = {
  accentBarW: number;
  iconX: number; iconY: number; iconFontSize: number;
  titleX: number; titleY: number; titleW: number; titleH: number; titleFontSize: number;
  accentLineY: number;
  subtitleX: number; subtitleY: number; subtitleW: number; subtitleH: number; subtitleFontSize: number;
  imageX: number; imageY: number; imageW: number; imageH: number;
};

type TemplateLayout = {
  slideW: number; slideH: number;
  header: { x: number; y: number; w: number; h: number };
  headerIconX: number;
  headerTitleX: number;
  contentArea: { x: number; y: number; w: number; h: number };
  imageArea: { x: number; y: number; w: number; h: number };
  footer: { x: number; y: number; w: number; h: number };
  progressBar: { y: number; h: number };
  titleSlide: TitleSlideLayout;
};

export type TemplateConfig = {
  id: string;
  name: string;
  description: string;
  colors: TemplateColors;
  fonts: TemplateFonts;
  layout: TemplateLayout;
};

// ─── Public API types ─────────────────────────────────────────────────────────

export type TemplateId = "classic" | "modern" | "warm" | "dark" | "minimal";
export const TEMPLATE_IDS: readonly TemplateId[] = ["classic", "modern", "warm", "dark", "minimal"];
export const DEFAULT_TEMPLATE_ID: TemplateId = "classic";

export function isValidTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);
}

// ─── Static template data (bundled from JSON at build time) ───────────────────

import classicJson from "./ppt-templates/classic.json";
import modernJson  from "./ppt-templates/modern.json";
import warmJson    from "./ppt-templates/warm.json";
import darkJson    from "./ppt-templates/dark.json";
import minimalJson from "./ppt-templates/minimal.json";

const TEMPLATE_MAP: Record<TemplateId, TemplateConfig> = {
  classic: classicJson as TemplateConfig,
  modern:  modernJson  as TemplateConfig,
  warm:    warmJson    as TemplateConfig,
  dark:    darkJson    as TemplateConfig,
  minimal: minimalJson as TemplateConfig,
};

export function getTemplateConfig(id: string): TemplateConfig {
  return TEMPLATE_MAP[id as TemplateId] ?? TEMPLATE_MAP.classic;
}

/** Card metadata consumed by the UI theme selector. */
export const TEMPLATE_CARDS: readonly {
  id: TemplateId;
  themeNumber: number;
  name: string;
  description: string;
  preview: readonly [string, string, string];
}[] = [
  { id: "classic", themeNumber: 1, name: "Classic", description: "Clean professional Navy and White", preview: ["0A1628", "00C6A7", "FFFFFF"] },
  { id: "modern",  themeNumber: 2, name: "Modern",  description: "Bold Minimal Teal and White",       preview: ["00C6A7", "0A8F7A", "FFFFFF"] },
  { id: "warm",    themeNumber: 3, name: "Warm",    description: "Friendly Orange and Cream",          preview: ["E8622A", "F5A623", "FFF8F0"] },
  { id: "dark",    themeNumber: 4, name: "Dark",    description: "Premium Dark Navy and Gold",         preview: ["1A1A2E", "FFD700", "16213E"] },
  { id: "minimal", themeNumber: 5, name: "Minimal", description: "Pure Clean White",                  preview: ["111827", "6B7280", "FFFFFF"] },
];

// ─── Slide icons (0-based deck index) ────────────────────────────────────────

const SLIDE_ICONS: readonly string[] = [
  "🎓", // 0  Subject / Grade / Date
  "🎯", // 1  Starter Activity
  "📚", // 2  Chapter, Topic and SDG Goal
  "🎯", // 3  Learning Objectives
  "✅", // 4  Learning Outcomes
  "📖", // 5  Main Phase Core Teaching
  "🎨", // 6  Differentiated Activity and Mini Plenary
  "🌍", // 7  UAE / Real-Life Connection
  "🏆", // 8  Plenary
  "🏠", // 9  Extended Task
  "🎫", // 10 Exit Ticket
  "⭐", // 11 Success Criteria and Self Evaluation
  "👏", // 12 Thank You
];

// ─── Fixed layout constants (same for every template) ────────────────────────

const SLIDE_W   = 13.333;
const SLIDE_H   = 7.5;
const HEADER_H  = 1.2;
const FOOTER_Y  = 7.1;
const FOOTER_H  = 0.4;

// Header interior
const HDR_ICON_Y = 0.1;
const HDR_ICON_W = 0.88;
const HDR_ICON_H = 1.0;
const HDR_TITLE_Y = 0.1;
const HDR_TITLE_H = 1.0;

// Content / image columns
const CONTENT_X            = 0.3;
const CONTENT_Y            = HEADER_H + 0.15;   // 1.35"
const CONTENT_W_WITH_IMAGE = 7.73;
const CONTENT_W_FULL       = 12.88;
const CONTENT_H            = FOOTER_Y - CONTENT_Y - 0.1;   // 5.65"
const IMAGE_X = 8.67;
const IMAGE_W = 4.51;

// Footer interior
const FTR_TEXT_Y   = FOOTER_Y + 0.07;
const FTR_TEXT_H   = 0.26;
const FTR_SUBJ_X   = 0.3;
const FTR_SUBJ_W   = 5.2;
const FTR_LOGO_X   = 5.9;
const FTR_LOGO_Y   = FOOTER_Y + 0.04;
const FTR_LOGO_W   = 1.15;
const FTR_LOGO_H   = 0.32;
const FTR_NUM_X    = 11.35;
const FTR_NUM_W    = 1.85;
const PROGRESS_H   = 0.06;

// Chunking
const CPL_IMAGE = Math.floor(CONTENT_W_WITH_IMAGE * 7.6);  // ≈58
const CPL_FULL  = Math.floor(CONTENT_W_FULL       * 7.6);  // ≈97
const MAX_ROWS  = Math.floor(CONTENT_H / 0.32);            // ≈17

// ─── Text utilities ───────────────────────────────────────────────────────────

function normalizeToLines(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .replace(/```[\s\S]*?```/g, "\n")
    .split("\n")
    .map((l) => {
      let s = l.trim();
      s = s.replace(/^#{1,6}\s+/, "");
      s = s.replace(/^\s*(?:[-*+]|\d+[.):])\s+/, "");
      s = s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
      s = s.replace(/`([^`]+)`/g, "$1").replace(/_{1,2}([^_]+)_{1,2}/g, "$1");
      s = s.replace(/[*#_`|]/g, "").replace(/\s+/g, " ").trim();
      return s;
    })
    .filter((l) => l.length > 0);
}

function wrappedRows(line: string, cpl: number): number {
  return Math.max(1, Math.ceil(line.length / Math.max(1, cpl)));
}

function chunkLines(lines: string[], cpl: number, maxRows: number): string[][] {
  const chunks: string[][] = [];
  let cur: string[] = [];
  let used = 0;
  for (const line of lines) {
    const r = wrappedRows(line, cpl);
    if (used + r > maxRows && cur.length > 0) { chunks.push(cur); cur = []; used = 0; }
    cur.push(line);
    used += r;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks.length > 0 ? chunks : [["(No content provided)"]];
}

// ─── Asset helpers ────────────────────────────────────────────────────────────

async function fetchAsDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const mime = (res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/png")
    .replace(/^(?!image\/).*/, "image/png");
  return `data:${mime};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}

let _logoCache: string | null | undefined;
async function loadLayahLogo(): Promise<string | null> {
  if (_logoCache !== undefined) return _logoCache;
  for (const n of ["Logo.png", "logo.png", "layah-logo.png"]) {
    try {
      const buf = await readFile(path.join(process.cwd(), "public", n));
      return (_logoCache = `data:image/png;base64,${buf.toString("base64")}`);
    } catch { /* try next */ }
  }
  return (_logoCache = null);
}

// ─── Per-slide render helpers ─────────────────────────────────────────────────

function addFooter(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  tpl: TemplateConfig,
  subject: string,
  slideNum: number,
  total: number,
  layahLogo: string | null,
): void {
  const c = tpl.colors;
  const f = tpl.fonts;
  const progY = tpl.layout.progressBar.y;
  const progH = tpl.layout.progressBar.h;

  // footer background
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: FOOTER_Y, w: SLIDE_W, h: FOOTER_H,
    fill: { color: c.footerBackground }, line: { color: c.footerBackground },
  });
  // top border line
  slide.addShape(pptx.ShapeType.line, {
    x: 0, y: FOOTER_Y, w: SLIDE_W, h: 0,
    line: { color: c.footerBorder, pt: 0.75 },
  });
  // subject
  slide.addText(subject, {
    x: FTR_SUBJ_X, y: FTR_TEXT_Y, w: FTR_SUBJ_W, h: FTR_TEXT_H,
    fontSize: 12, color: c.footerText, fontFace: f.face,
  });
  // Layah logo
  if (layahLogo) {
    slide.addImage({ data: layahLogo, x: FTR_LOGO_X, y: FTR_LOGO_Y, w: FTR_LOGO_W, h: FTR_LOGO_H, altText: "Layah" });
  }
  // slide number
  slide.addText(`Slide ${slideNum} of ${total}`, {
    x: FTR_NUM_X, y: FTR_TEXT_Y, w: FTR_NUM_W, h: FTR_TEXT_H,
    fontSize: 12, color: c.footerText, fontFace: f.face, align: "right",
  });
  // progress track
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: progY, w: SLIDE_W, h: progH,
    fill: { color: c.progressTrack }, line: { color: c.progressTrack },
  });
  // progress fill
  if (total > 1) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: progY, w: (slideNum / total) * SLIDE_W, h: progH,
      fill: { color: c.progressFill }, line: { color: c.progressFill },
    });
  }
}

function addSchoolLogo(pptx: PptxGenJS, slide: PptxGenJS.Slide, logoDataUri: string): void {
  const lw = 1.85, lh = 0.38;
  const lx = SLIDE_W - 0.3 - lw, ly = 0.26;
  slide.addShape(pptx.ShapeType.rect, {
    x: lx - 0.05, y: ly - 0.04, w: lw + 0.1, h: lh + 0.08,
    fill: { color: "FFFFFF", transparency: 20 },
    line: { color: "FFFFFF", transparency: 60, pt: 0.5 },
  });
  slide.addImage({ data: logoDataUri, x: lx, y: ly, w: lw, h: lh, altText: "School logo" });
}

function doTitleSlide(
  pptx: PptxGenJS,
  model: StructuredLessonSlideModel,
  tpl: TemplateConfig,
  subject: string,
  grade: string,
  imageDataUri: string | null,
  slideNum: number,
  total: number,
  layahLogo: string | null,
  schoolLogo: string | null,
): void {
  const slide = pptx.addSlide();
  const c = tpl.colors;
  const f = tpl.fonts;
  const L = tpl.layout.titleSlide;

  slide.background = { color: c.titleSlideBackground };

  // left accent bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: L.accentBarW, h: SLIDE_H,
    fill: { color: c.accent }, line: { color: c.accent },
  });
  // top accent stripe
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: 0.1,
    fill: { color: c.accent }, line: { color: c.accent },
  });

  // subject · grade label
  slide.addText(`${subject}  ·  ${grade}`, {
    x: L.iconX, y: 0.46, w: 7.5, h: 0.44,
    fontSize: 17, color: c.accent, fontFace: f.face,
  });

  // icon
  slide.addText(SLIDE_ICONS[0] ?? "🎓", {
    x: L.iconX, y: L.iconY, w: 1.1, h: 1.1,
    fontSize: L.iconFontSize, align: "left", valign: "middle",
  });

  // main title
  slide.addText(subject, {
    x: L.titleX, y: L.titleY, w: L.titleW, h: L.titleH,
    fontSize: L.titleFontSize, bold: true,
    color: c.titleSlideTitle, fontFace: f.face, valign: "middle", fit: "shrink",
  });

  // accent line
  slide.addShape(pptx.ShapeType.line, {
    x: L.titleX, y: L.accentLineY, w: L.titleW * 0.85, h: 0,
    line: { color: c.accent, pt: 2.5 },
  });

  // subtitle: grade / date from body
  const bodyLines = normalizeToLines(model.body);
  slide.addText(bodyLines.slice(0, 3).join("   ·   "), {
    x: L.subtitleX, y: L.subtitleY, w: L.subtitleW, h: L.subtitleH,
    fontSize: L.subtitleFontSize, color: c.titleSlideSubtitle, fontFace: f.face,
    valign: "top", fit: "shrink",
  });

  // image
  if (imageDataUri) {
    const pad = 0.08;
    slide.addShape(pptx.ShapeType.rect, {
      x: L.imageX - pad, y: L.imageY - pad,
      w: L.imageW + pad * 2, h: L.imageH + pad * 2,
      fill: { color: c.imagePanelBackground },
      line: { color: c.imagePanelBorder, pt: 1.5 },
    });
    slide.addImage({
      data: imageDataUri, x: L.imageX, y: L.imageY, w: L.imageW, h: L.imageH,
      altText: "Title slide illustration",
    });
  }

  addFooter(pptx, slide, tpl, subject, slideNum, total, layahLogo);
  if (schoolLogo) addSchoolLogo(pptx, slide, schoolLogo);
  slide.addNotes(model.speakerNotes ?? "");
}

function doContentSlide(
  pptx: PptxGenJS,
  model: StructuredLessonSlideModel,
  deckIdx: number,
  chunk: string[],
  chunkIdx: number,
  tpl: TemplateConfig,
  imageDataUri: string | null,
  subject: string,
  slideNum: number,
  total: number,
  layahLogo: string | null,
  schoolLogo: string | null,
): void {
  const slide = pptx.addSlide();
  const c = tpl.colors;
  const f = tpl.fonts;
  const L = tpl.layout;
  const isCont = chunkIdx > 0;
  const hasImg = imageDataUri !== null && !isCont;

  slide.background = { color: c.background };

  // ── Header bar ──
  slide.addShape(pptx.ShapeType.rect, {
    x: L.header.x, y: L.header.y, w: L.header.w, h: L.header.h,
    fill: { color: c.headerBar }, line: { color: c.headerBar },
  });

  // icon (first chunk only)
  if (!isCont) {
    const icon = SLIDE_ICONS[deckIdx] ?? "";
    if (icon) {
      slide.addText(icon, {
        x: L.headerIconX, y: HDR_ICON_Y, w: HDR_ICON_W, h: HDR_ICON_H,
        fontSize: 32, align: "center", valign: "middle",
      });
    }
  }

  // title
  const rawTitle = model.slideTitle.replace(/\r\n/g, " ").trim();
  const titleDisplay = isCont ? `${rawTitle}  (Continued)` : rawTitle;
  const titleX = isCont ? 0.3 : L.headerTitleX;
  const titleW = isCont ? L.header.w - 0.4 : L.header.w - L.headerTitleX - 0.2;
  slide.addText(titleDisplay, {
    x: titleX, y: HDR_TITLE_Y, w: titleW, h: HDR_TITLE_H,
    fontSize: f.titleSize, bold: true,
    color: c.headerText, fontFace: f.face, valign: "middle", fit: "shrink",
  });

  // ── Body content ──
  const contentW = hasImg ? CONTENT_W_WITH_IMAGE : CONTENT_W_FULL;
  type TextRun = { text: string; options: Record<string, unknown> };
  const runs: TextRun[] = [];
  for (let i = 0; i < chunk.length; i++) {
    runs.push({ text: chunk[i]!, options: { color: c.contentText, fontSize: f.contentSize, fontFace: f.face } });
    if (i < chunk.length - 1) runs.push({ text: "", options: { breakLine: true } });
  }
  slide.addText(runs, {
    x: CONTENT_X, y: CONTENT_Y, w: contentW, h: CONTENT_H,
    valign: "top", paraSpaceAfter: 5, lineSpacingMultiple: 1.2,
  });

  // ── Image panel ──
  if (hasImg) {
    const pad = 0.08;
    slide.addShape(pptx.ShapeType.rect, {
      x: IMAGE_X, y: CONTENT_Y, w: IMAGE_W, h: CONTENT_H,
      fill: { color: c.imagePanelBackground },
      line: { color: c.imagePanelBorder, pt: 1 },
    });
    slide.addImage({
      data: imageDataUri,
      x: IMAGE_X + pad, y: CONTENT_Y + pad,
      w: IMAGE_W - pad * 2, h: CONTENT_H - pad * 2,
      altText: "AI-generated illustration",
    });
  }

  addFooter(pptx, slide, tpl, subject, slideNum, total, layahLogo);
  if (schoolLogo) addSchoolLogo(pptx, slide, schoolLogo);

  const notes = isCont
    ? `${model.speakerNotes ?? ""}\n\n(Continuation slide — same section.)`
    : (model.speakerNotes ?? "");
  slide.addNotes(notes);
}

// ─── Main build function ──────────────────────────────────────────────────────

export async function buildPptxFromTemplateEngine(params: {
  templateId: TemplateId | string;
  slides: StructuredLessonSlideModel[];
  subject: string;
  grade: string;
  topic: string;
  teacherName?: string;
  slideImageUrls?: (string | null)[] | null;
  schoolLogo?: string | null;
}): Promise<Buffer> {
  const tpl = getTemplateConfig(params.templateId);
  const deck = params.slides;

  // Resolve image URLs to data URIs in parallel
  const imageDataUris: (string | null)[] = await Promise.all(
    deck.map(async (_, i) => {
      const url = params.slideImageUrls?.[i] ?? null;
      if (!url) return null;
      try { return await fetchAsDataUri(url); } catch { return null; }
    }),
  );

  const layahLogo = await loadLayahLogo();
  const schoolLogo = params.schoolLogo ?? null;

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Layah.ai";
  pptx.company = "Layah.ai";
  pptx.subject = `${params.subject} — ${params.topic}`;
  pptx.title   = `Slides — ${params.topic}`;

  // Pre-compute total physical slide count (for footer "N of M")
  let totalPhysical = 1; // always 1 for title slide
  for (let i = 1; i < deck.length; i++) {
    const hasImg = Boolean(imageDataUris[i]);
    const cpl = hasImg ? CPL_IMAGE : CPL_FULL;
    const lines = normalizeToLines(deck[i]!.body);
    totalPhysical += chunkLines(lines, cpl, MAX_ROWS).length;
  }

  let slideNum = 1;

  for (let di = 0; di < deck.length; di++) {
    const model = deck[di]!;
    const imgUri = imageDataUris[di] ?? null;

    if (di === 0) {
      doTitleSlide(pptx, model, tpl, params.subject, params.grade, imgUri, slideNum, totalPhysical, layahLogo, schoolLogo);
      slideNum++;
      continue;
    }

    const hasImg = imgUri !== null;
    const cpl = hasImg ? CPL_IMAGE : CPL_FULL;
    const lines = normalizeToLines(model.body);
    const chunks = chunkLines(lines, cpl, MAX_ROWS);

    for (let ci = 0; ci < chunks.length; ci++) {
      doContentSlide(
        pptx, model, di, chunks[ci]!, ci, tpl,
        ci === 0 ? imgUri : null,
        params.subject, slideNum, totalPhysical, layahLogo, schoolLogo,
      );
      slideNum++;
    }
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
