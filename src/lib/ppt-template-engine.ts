/**
 * Template-based PPT rendering engine for Layah.
 *
 * Layout contract (identical across all templates, per design spec):
 *   Header bar  — top 1.2 in, full width
 *   Content area — left 60 % (x 0.3, w 7.73)
 *   Image area   — right 35 % (x 8.67, w 4.51), 5 % gap
 *   Footer       — bottom 0.4 in: subject · logo · slide number · progress bar
 *
 * Visual system: the fixed 13-slide deck (see ppt-structured-lesson.ts) is always the same
 * shape, so each deck index gets a fixed "slide kind" (hero / checklist / activity / standard)
 * that drives card styling, bullet markers, and chip labels — see SLIDE_KIND_BY_INDEX below.
 * Content text itself is never touched here; only how it's drawn.
 */

// Server-only: Node.js built-ins and pptxgenjs must not be imported by client components.
import { readFile } from "fs/promises";
import path from "path";
import PptxGenJS from "pptxgenjs";
import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";
import {
  drawIconBadge,
  drawSectionChip,
  drawRoundedImageFrame,
  drawBulletBlock,
  drawProgressPill,
  estimateRowHeight,
  estimateBlockHeight,
  getImageNaturalSize,
  type BulletVariant,
} from "@/lib/ppt-render-primitives";

// Re-export everything client components need from the client-safe config module.
export {
  type TemplateConfig,
  type TemplateId,
  TEMPLATE_IDS,
  DEFAULT_TEMPLATE_ID,
  isValidTemplateId,
  getTemplateConfig,
  TEMPLATE_CARDS,
} from "@/lib/ppt-template-config";

// Import for use within this file.
import { getTemplateConfig, type TemplateConfig, type TemplateId } from "@/lib/ppt-template-config";

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

// ─── Fixed slide "kind" per deck index — drives card/marker/chip styling ─────

type SlideKind = "hero-open" | "hero-close" | "checklist" | "activity" | "standard" | "concept";

const SLIDE_KIND_BY_INDEX: readonly SlideKind[] = [
  "hero-open",  // 0  Subject / Grade / Date
  "activity",   // 1  Starter Activity
  "standard",   // 2  Chapter, Topic and SDG Goal
  "checklist",  // 3  Learning Objectives
  "checklist",  // 4  Learning Outcomes
  "concept",    // 5  Main Phase Core Teaching — densest slide; diagram left, key concepts right
  "activity",   // 6  Differentiated Activity and Mini Plenary
  "standard",   // 7  UAE / Real-Life Connection
  "activity",   // 8  Plenary
  "activity",   // 9  Extended Task
  "standard",   // 10 Exit Ticket
  "checklist",  // 11 Success Criteria and Self Evaluation
  "hero-close", // 12 Thank You
];

const ACTIVITY_CHIP_LABEL: Record<number, string> = {
  1: "Warm-Up",
  6: "Differentiated Tasks",
  8: "Reflect & Share",
  9: "Take It Further",
};

/** Eyebrow chip for "concept" slides — currently just Main Phase (index 5). */
const CONCEPT_CHIP_LABEL: Record<number, string> = {
  5: "Key Concepts",
};

function bulletVariantFor(kind: SlideKind): BulletVariant {
  return kind === "checklist" ? "checklist" : kind === "activity" ? "activity" : "bullet";
}

function chipLabelFor(kind: SlideKind, deckIdx: number): string | undefined {
  if (kind === "activity") return ACTIVITY_CHIP_LABEL[deckIdx];
  if (kind === "concept") return CONCEPT_CHIP_LABEL[deckIdx];
  return undefined;
}

// ─── Fixed layout constants (same for every template) ────────────────────────

const SLIDE_W   = 13.333;
const SLIDE_H   = 7.5;
const HEADER_H  = 1.2;
const FOOTER_Y  = 7.1;
const FOOTER_H  = 0.4;

// Header interior
const HDR_BADGE_SIZE = 0.72;
const HDR_BADGE_X    = 0.3; // matches SLIDE_MARGIN below (declared after use)
const HDR_TITLE_Y = 0.1;
const HDR_TITLE_H = 1.0;

// Content / image columns — margins symmetric: 0.3" on both the left (content) and right (image)
// edge of the slide (previously the image panel ran to within 0.15" of the right edge while
// content stayed 0.3" from the left — an inconsistent margin, fixed here).
const SLIDE_MARGIN         = 0.3;
const CONTENT_X            = SLIDE_MARGIN;
const CONTENT_Y            = HEADER_H + 0.18;   // 1.38"
const CONTENT_W_WITH_IMAGE = 7.73;
const CONTENT_W_FULL       = SLIDE_W - SLIDE_MARGIN * 2;
const CONTENT_H            = FOOTER_Y - CONTENT_Y - 0.12;
const IMAGE_X = 8.67;
const IMAGE_W = SLIDE_W - SLIDE_MARGIN - IMAGE_X;
/** Gap between the content and image columns — used to mirror the layout for "concept" slides. */
const COLUMN_GAP = IMAGE_X - (CONTENT_X + CONTENT_W_WITH_IMAGE);
/** "concept" kind: image on the LEFT, content on the RIGHT (mirrors the standard layout). */
const CONCEPT_CONTENT_X = CONTENT_X + IMAGE_W + COLUMN_GAP;

// Footer interior
const FTR_TEXT_Y   = FOOTER_Y + 0.07;
const FTR_TEXT_H   = 0.26;
const FTR_SUBJ_X   = 0.3;
const FTR_SUBJ_W   = 5.2;
const FTR_LOGO_X   = 5.9;
const FTR_LOGO_Y   = FOOTER_Y + 0.04;
const FTR_LOGO_W   = 1.15;
const FTR_LOGO_H   = 0.32;
const FTR_NUM_W    = 1.85;
const FTR_NUM_X    = SLIDE_W - SLIDE_MARGIN - FTR_NUM_W; // right-aligned text, same 0.3" margin as everything else
const PROGRESS_H   = 0.08;

// Chunking — chars-per-line stays a font-metric estimate; row budgeting now uses actual
// per-row heights (marker + spacing) from ppt-render-primitives so bullets get real breathing
// room instead of being packed as dense wrapped paragraphs.
const CPL_IMAGE = Math.floor(CONTENT_W_WITH_IMAGE * 7.6);  // ≈58
const CPL_FULL  = Math.floor(CONTENT_W_FULL       * 7.6);  // ≈97
const CHIP_RESERVE_H = 0.46;

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

/** Splits `lines` into per-slide chunks that fit within `maxHeight`, using real row heights. */
function chunkLinesByHeight(lines: string[], cpl: number, maxHeight: number): string[][] {
  const chunks: string[][] = [];
  let cur: string[] = [];
  let used = 0;
  for (const line of lines) {
    const h = estimateRowHeight(line, cpl);
    if (used + h > maxHeight && cur.length > 0) { chunks.push(cur); cur = []; used = 0; }
    cur.push(line);
    used += h;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks.length > 0 ? chunks : [["(No content provided)"]];
}

// ─── Asset helpers ────────────────────────────────────────────────────────────

type ImageAsset = { dataUri: string; width: number | undefined; height: number | undefined };

async function fetchImageAsset(url: string): Promise<ImageAsset> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const mime = (res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/png")
    .replace(/^(?!image\/).*/, "image/png");
  const buf = Buffer.from(await res.arrayBuffer());
  const size = getImageNaturalSize(buf);
  return {
    dataUri: `data:${mime};base64,${buf.toString("base64")}`,
    width: size?.width, height: size?.height,
  };
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
  const progY = FOOTER_Y + (FOOTER_H - PROGRESS_H) / 2 - 0.02;

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
  slide.addText(`${slideNum} / ${total}`, {
    x: FTR_NUM_X, y: FTR_TEXT_Y, w: FTR_NUM_W, h: FTR_TEXT_H,
    fontSize: 12, color: c.footerText, fontFace: f.face, align: "right",
  });
  // rounded progress pill
  if (total > 1) {
    drawProgressPill(pptx, slide, {
      x: FTR_SUBJ_X, y: progY, w: SLIDE_W - FTR_SUBJ_X * 2, h: PROGRESS_H,
      ratio: slideNum / total, tpl,
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

function doHeroOpenSlide(
  pptx: PptxGenJS,
  model: StructuredLessonSlideModel,
  tpl: TemplateConfig,
  subject: string,
  grade: string,
  image: ImageAsset | null,
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

  // icon badge (translucent white on the dark/colored hero background)
  drawIconBadge(pptx, slide, {
    icon: SLIDE_ICONS[0] ?? "🎓", x: L.iconX, y: L.iconY, size: 0.9, tpl, onDark: true,
  });

  // subject · grade eyebrow chip (sits in the gap between the icon badge and the title)
  drawSectionChip(pptx, slide, { text: `${subject} · ${grade}`, x: L.iconX, y: L.iconY + 0.92, tpl });

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
  if (image) {
    drawRoundedImageFrame(pptx, slide, {
      x: L.imageX, y: L.imageY, w: L.imageW, h: L.imageH,
      imageDataUri: image.dataUri, naturalWidth: image.width, naturalHeight: image.height,
      tpl, altText: "Title slide illustration",
    });
  }

  addFooter(pptx, slide, tpl, subject, slideNum, total, layahLogo);
  if (schoolLogo) addSchoolLogo(pptx, slide, schoolLogo);
  slide.addNotes(model.speakerNotes ?? "");
}

function doHeroCloseSlide(
  pptx: PptxGenJS,
  model: StructuredLessonSlideModel,
  tpl: TemplateConfig,
  subject: string,
  slideNum: number,
  total: number,
  layahLogo: string | null,
  schoolLogo: string | null,
): void {
  const slide = pptx.addSlide();
  const c = tpl.colors;
  const f = tpl.fonts;

  slide.background = { color: c.titleSlideBackground };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: 0.1,
    fill: { color: c.accent }, line: { color: c.accent },
  });

  drawIconBadge(pptx, slide, {
    icon: SLIDE_ICONS[12] ?? "👏", x: (SLIDE_W - 1.1) / 2, y: 1.7, size: 1.1, tpl, onDark: true,
  });

  slide.addText(model.slideTitle, {
    x: 1.0, y: 3.1, w: SLIDE_W - 2.0, h: 1.0,
    fontSize: 40, bold: true, align: "center", valign: "middle",
    color: c.titleSlideTitle, fontFace: f.face, fit: "shrink",
  });

  slide.addText(model.body, {
    x: 1.6, y: 4.15, w: SLIDE_W - 3.2, h: 1.4,
    fontSize: 18, align: "center", valign: "top",
    color: c.titleSlideSubtitle, fontFace: f.face, lineSpacingMultiple: 1.3, fit: "shrink",
  });

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
  image: ImageAsset | null,
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
  const hasImg = image !== null && !isCont;
  const kind = SLIDE_KIND_BY_INDEX[deckIdx] ?? "standard";
  const variant = bulletVariantFor(kind);

  slide.background = { color: c.background };

  // ── Header bar ──
  slide.addShape(pptx.ShapeType.rect, {
    x: L.header.x, y: L.header.y, w: L.header.w, h: L.header.h,
    fill: { color: c.headerBar }, line: { color: c.headerBar },
  });
  // thin accent underline for depth
  slide.addShape(pptx.ShapeType.line, {
    x: 0, y: L.header.h, w: SLIDE_W, h: 0,
    line: { color: c.accent, pt: 2 },
  });

  // icon badge (first chunk only)
  if (!isCont) {
    const icon = SLIDE_ICONS[deckIdx] ?? "";
    if (icon) {
      drawIconBadge(pptx, slide, {
        icon, x: HDR_BADGE_X, y: (HEADER_H - HDR_BADGE_SIZE) / 2, size: HDR_BADGE_SIZE, tpl, onDark: true,
      });
    }
  }

  // title (+ small "Continued" eyebrow instead of appending to the title text)
  const rawTitle = model.slideTitle.replace(/\r\n/g, " ").trim();
  const titleX = isCont ? 0.3 : L.headerTitleX;
  const titleW = isCont ? L.header.w - 0.4 : L.header.w - L.headerTitleX - 0.2;
  if (isCont) {
    slide.addText("CONTINUED", {
      x: titleX, y: 0.14, w: titleW, h: 0.24,
      fontSize: 10.5, bold: true, color: c.accent, fontFace: f.face, charSpacing: 1,
    });
  }
  slide.addText(rawTitle, {
    x: titleX, y: isCont ? 0.36 : HDR_TITLE_Y, w: titleW, h: isCont ? 0.72 : HDR_TITLE_H,
    fontSize: f.titleSize, bold: true,
    color: c.headerText, fontFace: f.face, valign: "middle", fit: "shrink",
  });

  // ── Body content ──
  // "concept" slides (currently just Main Phase) mirror the standard layout — image on the left,
  // key-concept text on the right — instead of text-left/image-right. Same column widths either
  // way, just swapped, so the margin/gap math stays consistent with every other slide.
  const isConceptMirrored = kind === "concept" && hasImg;
  const contentW = hasImg ? CONTENT_W_WITH_IMAGE : CONTENT_W_FULL;
  const contentX = isConceptMirrored ? CONCEPT_CONTENT_X : CONTENT_X;
  let bodyY = CONTENT_Y;

  if (!isCont) {
    const chipLabel = chipLabelFor(kind, deckIdx);
    if (chipLabel) {
      drawSectionChip(pptx, slide, { text: chipLabel, x: contentX, y: bodyY, tpl });
      bodyY += CHIP_RESERVE_H;
    }
  }

  const cpl = hasImg ? CPL_IMAGE : CPL_FULL;

  // Vertically center short bodies within the remaining content area instead of pinning them to
  // the top — a 1-2 line body left top-aligned in a 5.65" box reads as broken/empty, not minimal.
  const availableBottom = CONTENT_Y + CONTENT_H;
  const usedH = estimateBlockHeight(chunk, cpl);
  const slack = Math.max(0, availableBottom - bodyY - usedH);
  bodyY += slack / 2;

  drawBulletBlock(pptx, slide, { x: contentX, y: bodyY, w: contentW, lines: chunk, tpl, variant, cpl });

  // ── Image panel ──
  if (hasImg && image) {
    drawRoundedImageFrame(pptx, slide, {
      x: isConceptMirrored ? CONTENT_X : IMAGE_X, y: CONTENT_Y, w: IMAGE_W, h: CONTENT_H,
      imageDataUri: image.dataUri, naturalWidth: image.width, naturalHeight: image.height,
      tpl, altText: "AI-generated illustration",
    });
  }

  addFooter(pptx, slide, tpl, subject, slideNum, total, layahLogo);
  if (schoolLogo) addSchoolLogo(pptx, slide, schoolLogo);

  const notes = isCont
    ? `${model.speakerNotes ?? ""}\n\n(Continuation slide — same section.)`
    : (model.speakerNotes ?? "");
  slide.addNotes(notes);
}

// ─── Deck layout stats (for internal QA scoring — see ppt-quality-report.ts) ──────────────────
//
// Deliberately decoupled from buildPptxFromTemplateEngine (duplicates a little of its chunk-
// budget math) rather than changing that function's return shape — this is an optional,
// zero-risk-to-production analysis path, not something wired into the real render/export flow.

export type SlideLayoutStat = {
  deckIdx: number;
  kind: SlideKind;
  hasImage: boolean;
  physicalSlideCount: number; // 1 = fits on one slide; >1 = needed "Continued" overflow slide(s)
  fillRatio: number; // 0 = empty box, 1 = exactly fills available content height, >1 = overflowed budget (shouldn't happen — chunking prevents it, but flagged if it does)
};

export function computeDeckLayoutStats(
  slides: StructuredLessonSlideModel[],
  slideImageUrls?: (string | null)[] | null,
): SlideLayoutStat[] {
  const stats: SlideLayoutStat[] = [
    { deckIdx: 0, kind: "hero-open", hasImage: Boolean(slideImageUrls?.[0]), physicalSlideCount: 1, fillRatio: 1 },
  ];
  for (let i = 1; i < slides.length; i++) {
    const kind = SLIDE_KIND_BY_INDEX[i] ?? "standard";
    if (kind === "hero-close") {
      stats.push({ deckIdx: i, kind, hasImage: false, physicalSlideCount: 1, fillRatio: 1 });
      continue;
    }
    const hasImg = Boolean(slideImageUrls?.[i]);
    const cpl = hasImg ? CPL_IMAGE : CPL_FULL;
    const chipReserve = chipLabelFor(kind, i) ? CHIP_RESERVE_H : 0;
    const budget = CONTENT_H - chipReserve;
    const lines = normalizeToLines(slides[i]!.body);
    const chunks = chunkLinesByHeight(lines, cpl, budget);
    const usedH = estimateBlockHeight(lines, cpl);
    stats.push({
      deckIdx: i, kind, hasImage: hasImg,
      physicalSlideCount: chunks.length,
      fillRatio: budget > 0 ? usedH / (budget * chunks.length) : 0,
    });
  }
  return stats;
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

  // Resolve image URLs to data URIs (+ natural dimensions, for undistorted placement) in parallel
  const images: (ImageAsset | null)[] = await Promise.all(
    deck.map(async (_, i) => {
      const url = params.slideImageUrls?.[i] ?? null;
      if (!url) return null;
      try { return await fetchImageAsset(url); } catch { return null; }
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

  // Pre-compute chunks (and physical slide count) per deck slide, reserving space for the
  // eyebrow chip (activity or concept kind) on the first physical chunk where one is shown.
  const chunksByDeckIdx: string[][][] = new Array(deck.length);
  let totalPhysical = 1; // always 1 for the hero-open slide
  for (let i = 1; i < deck.length; i++) {
    if (SLIDE_KIND_BY_INDEX[i] === "hero-close") { chunksByDeckIdx[i] = []; totalPhysical += 1; continue; }
    const hasImg = Boolean(images[i]);
    const cpl = hasImg ? CPL_IMAGE : CPL_FULL;
    const kind = SLIDE_KIND_BY_INDEX[i] ?? "standard";
    const budget = chipLabelFor(kind, i) ? CONTENT_H - CHIP_RESERVE_H : CONTENT_H;
    const lines = normalizeToLines(deck[i]!.body);
    const chunks = chunkLinesByHeight(lines, cpl, budget);
    chunksByDeckIdx[i] = chunks;
    totalPhysical += chunks.length;
  }

  let slideNum = 1;

  for (let di = 0; di < deck.length; di++) {
    const model = deck[di]!;
    const image = images[di] ?? null;
    const kind = SLIDE_KIND_BY_INDEX[di] ?? "standard";

    if (kind === "hero-open") {
      doHeroOpenSlide(pptx, model, tpl, params.subject, params.grade, image, slideNum, totalPhysical, layahLogo, schoolLogo);
      slideNum++;
      continue;
    }
    if (kind === "hero-close") {
      doHeroCloseSlide(pptx, model, tpl, params.subject, slideNum, totalPhysical, layahLogo, schoolLogo);
      slideNum++;
      continue;
    }

    const hasImg = image !== null;
    const chunks = chunksByDeckIdx[di]!;

    for (let ci = 0; ci < chunks.length; ci++) {
      doContentSlide(
        pptx, model, di, chunks[ci]!, ci, tpl,
        ci === 0 && hasImg ? image : null,
        params.subject, slideNum, totalPhysical, layahLogo, schoolLogo,
      );
      slideNum++;
    }
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
