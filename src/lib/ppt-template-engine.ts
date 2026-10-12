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
import type {
  DeckSpec,
  EducationalCompositionId,
  EducationalContentBlock,
  SlideSpec,
} from "@/lib/slide-schema";
import { MAX_DECK_SLIDES, parseDeckSpec } from "@/lib/slide-schema";
import {
  drawIconBadge,
  drawSectionChip,
  drawRoundedImageFrame,
  drawBulletBlock,
  drawProgressPill,
  estimateRowHeight,
  estimateBlockHeight,
  getImageNaturalSize,
  isGroupHeaderLine,
  type BulletVariant,
  type StablePptIcon,
  directionOptions,
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
import { fetchExternalImageSafely, sniffFileSignature } from "@/lib/upload-security";
import {
  DEFAULT_PRESENTATION_LANGUAGE,
  PPT_STRINGS,
  fontFaceFor,
  isRtlLanguage,
  pptString,
  type PptStringKey,
  type PresentationLanguage,
} from "@/lib/ppt-language";
import { validatePptContentSafety } from "@/lib/ppt-content-safety";
import { AFL_PHASE_GROUPS } from "@/lib/afl-tools";
import { repairPptxPackage } from "@/lib/pptx-repair";
import { getCompositionDefinition, blockText } from "@/lib/slide-composition-registry";
import { MAX_PHYSICAL_SLIDES, paginateToFit, selectDeckCompositions } from "@/lib/slide-layout-engine";
import {
  getPptDesignTokens,
  mirrorRegion,
  PPT_GRID,
  textFitsRegion,
  estimateTextHeight,
} from "@/lib/ppt-design-system";

// ─── Slide icons (0-based deck index) ────────────────────────────────────────

const SLIDE_ICONS: readonly StablePptIcon[] = [
  "academic", // 0  Subject / Grade / Date
  "target",   // 1  Starter Activity
  "book",     // 2  Chapter, Topic and SDG Goal
  "target",   // 3  Learning Objectives
  "check",    // 4  Learning Outcomes
  "concept",  // 5  Main Phase Core Teaching
  "activity", // 6  Differentiated Activity and Mini Plenary
  "world",    // 7  UAE / Real-Life Connection
  "trophy",   // 8  Plenary
  "home",     // 9  Extended Task
  "ticket",   // 10 Exit Ticket
  "star",     // 11 Success Criteria and Self Evaluation
  "close",    // 12 Thank You
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

/**
 * Everything the renderer needs to know about the deck's language in one place, so a new text
 * object cannot quietly ship an English label or a left-aligned Arabic paragraph.
 */
export type RenderContext = {
  language: PresentationLanguage;
  rtl: boolean;
  fontFace: string;
  /** Localised static-string lookup. */
  s: (key: PptStringKey) => string;
};

function buildRenderContext(language: PresentationLanguage, tpl: TemplateConfig): RenderContext {
  return {
    language,
    rtl: isRtlLanguage(language),
    fontFace: fontFaceFor(language, tpl.fonts.face),
    s: (key) => pptString(language, key),
  };
}

const ACTIVITY_CHIP_KEYS: Record<number, PptStringKey> = {
  1: "chipWarmUp",
  6: "chipDifferentiatedTasks",
  8: "chipReflectShare",
  9: "chipTakeItFurther",
};

/** Eyebrow chip for "concept" slides - currently just Main Phase (index 5). */
const CONCEPT_CHIP_KEYS: Record<number, PptStringKey> = { 5: "chipKeyConcepts" };

function bulletVariantFor(kind: SlideKind): BulletVariant {
  return kind === "checklist" ? "checklist" : kind === "activity" ? "activity" : "bullet";
}

function chipKeyFor(kind: SlideKind, deckIdx: number): PptStringKey | undefined {
  if (kind === "activity") return ACTIVITY_CHIP_KEYS[deckIdx];
  if (kind === "concept") return CONCEPT_CHIP_KEYS[deckIdx];
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

function isTeacherFacingRenderLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return (
    /^(?:time|timing|total duration|duration)\s*[:=]/i.test(t) ||
    /^step\s*\d+\s*\([^)]*(?:minute|min|mins)\)/i.test(t) ||
    /^(?:teacher|teacher instructions?|instructions to students?|display or say|pose this question|ask students|call on|circulate|collect responses|expected outcome|selected afl|purpose|why this works)\b/i.test(t) ||
    /\b(?:teacher-selected|system-recommended|quick formative assessment|student autonomy and differentiation|visualises progress|clear success measurement|self-assessment)\b/i.test(t)
  );
}

export function moveTeacherFacingLinesToNotes(model: StructuredLessonSlideModel): StructuredLessonSlideModel {
  const rawLines = model.body.replace(/\r\n/g, "\n").split("\n");
  const studentLines: string[] = [];
  const noteLines: string[] = [];

  for (const raw of rawLines) {
    const line = raw.trim();
    if (line && isTeacherFacingRenderLine(line)) {
      noteLines.push(line);
    } else {
      studentLines.push(raw);
    }
  }

  if (noteLines.length === 0) return model;
  const body = studentLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const movedNotes = `Teacher-facing details moved from slide body:\n${noteLines.join("\n")}`;
  return {
    ...model,
    body: body || model.body,
    speakerNotes: [model.speakerNotes, movedNotes].filter(Boolean).join("\n\n"),
  };
}

/**
 * Splits `lines` into per-slide chunks that fit within `maxHeight`, using real row heights.
 * `variant` must match what `drawBulletBlock` will render these lines with — passed through to
 * `estimateRowHeight` so a group-header row (activity slides only) is budgeted the same extra
 * height it's actually drawn with, rather than the chunker under-reserving for it.
 */
/** Exported for testing only — see computeDeckLayoutStats above for the same rationale. */
export function chunkLinesByHeight(
  lines: string[],
  cpl: number,
  maxHeight: number,
  variant?: BulletVariant,
  /** Shown when a slide body has no renderable lines; localised by the caller. */
  emptyPlaceholder: string = PPT_STRINGS.en.noContentProvided,
): string[][] {
  const chunks: string[][] = [];
  let cur: string[] = [];
  let used = 0;
  for (const line of lines) {
    const h = estimateRowHeight(line, cpl, 1, variant);
    if (used + h > maxHeight && cur.length > 0) {
      // Never end a chunk with a standalone sub-heading ("Step 2", "Higher Achievers task")
      // as its last line — that strands the heading alone on one slide with none of its own
      // content, which then opens a "Continued" slide with no heading at all. Carry the
      // heading forward into the new chunk instead so it stays paired with its content.
      let carry: string[] = [];
      let carryUsed = 0;
      const lastLine = cur[cur.length - 1];
      if (variant === "activity" && lastLine !== undefined && isGroupHeaderLine(lastLine)) {
        cur.pop();
        carry = [lastLine];
        carryUsed = estimateRowHeight(lastLine, cpl, 1, variant);
      }
      if (cur.length > 0) chunks.push(cur);
      cur = carry;
      used = carryUsed;
    }
    cur.push(line);
    used += h;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks.length > 0 ? chunks : [[emptyPlaceholder]];
}

// ─── Asset helpers ────────────────────────────────────────────────────────────

type ImageAsset = { dataUri: string; width: number | undefined; height: number | undefined };

const SNIFFED_KIND_TO_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

async function fetchImageAsset(url: string): Promise<ImageAsset> {
  // SSRF-guarded: only fetches https URLs on an allowlisted image-CDN host
  // whose resolved IP is public (see upload-security.ts). Every slide image
  // URL reaching this function today comes from Pexels'/fal.ai's own API
  // response, never from user input, but this is the one place in the app
  // that fetches a URL server-side, so it gets the hardening regardless.
  const buf = await fetchExternalImageSafely(url);
  // Trust the actual bytes, not whatever content-type the remote server
  // claims — a spoofed header is exactly what "validate by magic bytes" is
  // for.
  const sniffed = sniffFileSignature(buf);
  const mime = (sniffed && SNIFFED_KIND_TO_MIME[sniffed]) || "image/png";
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
  fontFace: string,
  subject: string,
  slideNum: number,
  total: number,
  layahLogo: string | null,
): void {
  const c = tpl.colors;
  const f = { ...tpl.fonts, face: fontFace };
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
  topic: string,
  image: ImageAsset | null,
  slideNum: number,
  total: number,
  layahLogo: string | null,
  schoolLogo: string | null,
  ctx: RenderContext,
): void {
  const slide = pptx.addSlide();
  const c = tpl.colors;
  const f = { ...tpl.fonts, face: ctx.fontFace };
  const L = tpl.layout.titleSlide;
  const dir = directionOptions(ctx.rtl);

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
    icon: SLIDE_ICONS[0] ?? "academic", x: L.iconX, y: L.iconY, size: 0.9, tpl, onDark: true,
  });

  // subject · grade eyebrow chip (sits in the gap between the icon badge and the title)
  drawSectionChip(pptx, slide, {
    text: `${subject} · ${grade}`, x: L.iconX, y: L.iconY + 0.92, tpl, fontFace: ctx.fontFace,
  });

  const titleTextW =
    image && L.imageX > L.titleX
      ? Math.max(4.2, Math.min(L.titleW, L.imageX - L.titleX - 0.45))
      : L.titleW;
  const subtitleTextW =
    image && L.imageX > L.subtitleX
      ? Math.max(4.2, Math.min(L.subtitleW, L.imageX - L.subtitleX - 0.45))
      : L.subtitleW;

  // main title
  slide.addText(topic.trim() || subject, {
    x: L.titleX, y: L.titleY, w: titleTextW, h: L.titleH,
    fontSize: L.titleFontSize, bold: true,
    color: c.titleSlideTitle, fontFace: f.face, valign: "middle", fit: "shrink", ...dir,
  });

  // accent line
  slide.addShape(pptx.ShapeType.line, {
    x: L.titleX, y: L.accentLineY, w: titleTextW * 0.85, h: 0,
    line: { color: c.accent, pt: 2.5 },
  });

  // subtitle: grade / date from body
  const bodyLines = normalizeToLines(model.body);
  slide.addText([subject, ...bodyLines.slice(0, 3)].filter(Boolean).join("   /   "), {
    x: L.subtitleX, y: L.subtitleY, w: subtitleTextW, h: L.subtitleH,
    fontSize: L.subtitleFontSize, color: c.titleSlideSubtitle, fontFace: f.face,
    valign: "top", fit: "shrink", ...dir,
  });

  // image
  if (image) {
    drawRoundedImageFrame(pptx, slide, {
      x: L.imageX, y: L.imageY, w: L.imageW, h: L.imageH,
      imageDataUri: image.dataUri, naturalWidth: image.width, naturalHeight: image.height,
      tpl, altText: ctx.s("altTitleIllustration"),
    });
  }

  addFooter(pptx, slide, tpl, ctx.fontFace, subject, slideNum, total, layahLogo);
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
  ctx: RenderContext,
): void {
  const slide = pptx.addSlide();
  const c = tpl.colors;
  const f = { ...tpl.fonts, face: ctx.fontFace };
  // Centred text stays centred in both directions - only paragraph direction and language need
  // to change, so alignment is deliberately not overridden here.
  const dirCentered = ctx.rtl ? { rtlMode: true, lang: "ar-AE" } : {};

  slide.background = { color: c.titleSlideBackground };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: 0.1,
    fill: { color: c.accent }, line: { color: c.accent },
  });

  drawIconBadge(pptx, slide, {
    icon: SLIDE_ICONS[12] ?? "close", x: (SLIDE_W - 1.1) / 2, y: 1.7, size: 1.1, tpl, onDark: true,
  });

  slide.addText(model.slideTitle, {
    x: 1.0, y: 3.1, w: SLIDE_W - 2.0, h: 1.0,
    fontSize: 40, bold: true, align: "center", valign: "middle",
    color: c.titleSlideTitle, fontFace: f.face, fit: "shrink", ...dirCentered,
  });

  slide.addText(model.body, {
    x: 1.6, y: 4.15, w: SLIDE_W - 3.2, h: 1.4,
    fontSize: 18, align: "center", valign: "top",
    color: c.titleSlideSubtitle, fontFace: f.face, lineSpacingMultiple: 1.3, fit: "shrink",
    ...dirCentered,
  });

  addFooter(pptx, slide, tpl, ctx.fontFace, subject, slideNum, total, layahLogo);
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
  ctx: RenderContext,
): void {
  const slide = pptx.addSlide();
  const c = tpl.colors;
  const f = { ...tpl.fonts, face: ctx.fontFace };
  const L = tpl.layout;
  const dir = directionOptions(ctx.rtl);
  const isCont = chunkIdx > 0;
  const hasImg = image !== null && !isCont;
  const kind = SLIDE_KIND_BY_INDEX[deckIdx] ?? "standard";
  const variant = bulletVariantFor(kind);

  slide.background = { color: c.background };

  if (!isCont) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: HEADER_H,
      w: 0.08,
      h: SLIDE_H - HEADER_H - FOOTER_H,
      fill: { color: c.accent, transparency: kind === "standard" ? 35 : 8 },
      line: { color: c.accent, transparency: 100 },
    });
  }

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
    const icon = SLIDE_ICONS[deckIdx];
    if (icon) {
      drawIconBadge(pptx, slide, {
        icon, x: HDR_BADGE_X, y: (HEADER_H - HDR_BADGE_SIZE) / 2, size: HDR_BADGE_SIZE, tpl, onDark: true,
      });
    }
  }

  // title
  const rawTitle = model.slideTitle.replace(/\r\n/g, " ").trim();
  const titleX = isCont ? 0.3 : L.headerTitleX;
  const titleW = isCont ? L.header.w - 0.4 : L.header.w - L.headerTitleX - 0.2;
  slide.addText(rawTitle, {
    x: titleX, y: HDR_TITLE_Y, w: titleW, h: HDR_TITLE_H,
    fontSize: f.titleSize, bold: true,
    color: c.headerText, fontFace: f.face, valign: "middle", fit: "shrink", ...dir,
  });

  // ── Body content ──
  // "concept" slides (currently just Main Phase) mirror the standard layout — image on the left,
  // key-concept text on the right — instead of text-left/image-right. Same column widths either
  // way, just swapped, so the margin/gap math stays consistent with every other slide.
  // Column order. "concept" slides (currently Main Phase) already mirrored the standard
  // text-left/image-right layout; on an RTL deck the reading order flips, so the text column
  // belongs on the right for ordinary slides and on the left for concept slides. XOR expresses
  // exactly that, and collapses to the previous behaviour for English.
  const imageOnLeft = hasImg && (kind === "concept") !== ctx.rtl;
  const contentW = hasImg ? CONTENT_W_WITH_IMAGE : CONTENT_W_FULL;
  const contentX = imageOnLeft ? CONCEPT_CONTENT_X : CONTENT_X;
  let bodyY = CONTENT_Y;

  if (!isCont) {
    const chipKey = chipKeyFor(kind, deckIdx);
    if (chipKey) {
      drawSectionChip(pptx, slide, {
        text: ctx.s(chipKey), x: contentX, y: bodyY, tpl, fontFace: ctx.fontFace,
      });
      bodyY += CHIP_RESERVE_H;
    }
  }

  const cpl = hasImg ? CPL_IMAGE : CPL_FULL;

  // Vertically center short bodies within the remaining content area instead of pinning them to
  // the top — a 1-2 line body left top-aligned in a 5.65" box reads as broken/empty, not minimal.
  const availableBottom = CONTENT_Y + CONTENT_H;
  const budgetH = availableBottom - bodyY;
  const baseUsedH = estimateBlockHeight(chunk, cpl, 1, variant);
  const fillRatio = budgetH > 0 ? baseUsedH / budgetH : 1;
  // Sparse slide — grow the body text instead of leaving it small in a mostly-empty box.
  // Capped well short of 1.0x-to-2.0x so this never risks overflowing the height this chunk
  // was already budgeted for by chunkLinesByHeight.
  const fontScale = fillRatio < 0.5 ? 1.2 : fillRatio < 0.72 ? 1.1 : 1;
  const usedH = fontScale === 1 ? baseUsedH : estimateBlockHeight(chunk, cpl, fontScale, variant);
  const slack = Math.max(0, availableBottom - bodyY - usedH);
  bodyY += slack / 2;

  drawBulletBlock(pptx, slide, {
    x: contentX, y: bodyY, w: contentW, lines: chunk, tpl, variant, cpl,
    scale: fontScale, rtl: ctx.rtl, fontFace: ctx.fontFace,
  });

  // ── Image panel ──
  if (hasImg && image) {
    drawRoundedImageFrame(pptx, slide, {
      x: imageOnLeft ? CONTENT_X : IMAGE_X, y: CONTENT_Y, w: IMAGE_W, h: CONTENT_H,
      imageDataUri: image.dataUri, naturalWidth: image.width, naturalHeight: image.height,
      tpl, altText: ctx.s("altSlideIllustration"),
    });
  }

  addFooter(pptx, slide, tpl, ctx.fontFace, subject, slideNum, total, layahLogo);
  if (schoolLogo) addSchoolLogo(pptx, slide, schoolLogo);

  const notes = isCont
    ? `${model.speakerNotes ?? ""}\n\n${ctx.s("continuationNote")}`
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
    const variant = bulletVariantFor(kind);
    const chipReserve = chipKeyFor(kind, i) ? CHIP_RESERVE_H : 0;
    const budget = CONTENT_H - chipReserve;
    const lines = normalizeToLines(slides[i]!.body);
    const chunks = chunkLinesByHeight(lines, cpl, budget, variant);
    const usedH = estimateBlockHeight(lines, cpl, 1, variant);
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
  /** Deck language. Defaults to English so existing callers render exactly as before. */
  language?: PresentationLanguage;
}): Promise<Buffer> {
  const tpl = getTemplateConfig(params.templateId);
  const deck = params.slides.map(moveTeacherFacingLinesToNotes);
  const language = params.language ?? DEFAULT_PRESENTATION_LANGUAGE;
  const ctx = buildRenderContext(language, tpl);
  const safetyWarnings = validatePptContentSafety(deck);
  if (safetyWarnings.length > 0) {
    console.warn(
      "[pptx render] content safety warnings:",
      JSON.stringify(safetyWarnings.map((w) => ({
        slide: w.slideNumber1Based,
        kind: w.kind,
        message: w.message,
      }))),
    );
  }

  // Resolve image URLs to data URIs (+ natural dimensions, for undistorted placement) in parallel
  const images: (ImageAsset | null)[] = await Promise.all(
    deck.map(async (_, i) => {
      const url = params.slideImageUrls?.[i] ?? null;
      if (!url) return null;
      try {
        return await fetchImageAsset(url);
      } catch (err) {
        // An expired or unreachable image URL used to vanish silently here, which made a
        // successfully generated image indistinguishable from one that never arrived.
        console.error(
          `[pptx render] slide ${i + 1}: could not download its image - ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      }
    }),
  );

  const layahLogo = await loadLayahLogo();
  const schoolLogo = params.schoolLogo ?? null;

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  // Presentation-level RTL: PowerPoint uses this for the deck's default paragraph direction,
  // complementing the per-text-object rtlMode set on every run below.
  pptx.rtlMode = ctx.rtl;
  pptx.author = "Layah.ai";
  pptx.company = "Layah.ai";
  pptx.subject = `${params.subject} — ${params.topic}`;
  pptx.title   = `${ctx.s("deckTitlePrefix")} — ${params.topic}`;

  // Pre-compute chunks (and physical slide count) per deck slide, reserving space for the
  // eyebrow chip (activity or concept kind) on the first physical chunk where one is shown.
  const chunksByDeckIdx: string[][][] = new Array(deck.length);
  let totalPhysical = 1; // always 1 for the hero-open slide
  for (let i = 1; i < deck.length; i++) {
    if (SLIDE_KIND_BY_INDEX[i] === "hero-close") { chunksByDeckIdx[i] = []; totalPhysical += 1; continue; }
    const hasImg = Boolean(images[i]);
    const cpl = hasImg ? CPL_IMAGE : CPL_FULL;
    const kind = SLIDE_KIND_BY_INDEX[i] ?? "standard";
    const budget = chipKeyFor(kind, i) ? CONTENT_H - CHIP_RESERVE_H : CONTENT_H;
    const lines = normalizeToLines(deck[i]!.body);
    const chunks = chunkLinesByHeight(
      lines, cpl, budget, bulletVariantFor(kind), ctx.s("noContentProvided"),
    );
    chunksByDeckIdx[i] = chunks;
    totalPhysical += chunks.length;
  }

  let slideNum = 1;

  for (let di = 0; di < deck.length; di++) {
    const model = deck[di]!;
    const image = images[di] ?? null;
    const kind = SLIDE_KIND_BY_INDEX[di] ?? "standard";

    if (kind === "hero-open") {
      doHeroOpenSlide(pptx, model, tpl, params.subject, params.grade, params.topic, image, slideNum, totalPhysical, layahLogo, schoolLogo, ctx);
      slideNum++;
      continue;
    }
    if (kind === "hero-close") {
      doHeroCloseSlide(pptx, model, tpl, params.subject, slideNum, totalPhysical, layahLogo, schoolLogo, ctx);
      slideNum++;
      continue;
    }

    const hasImg = image !== null;
    const chunks = chunksByDeckIdx[di]!;

    for (let ci = 0; ci < chunks.length; ci++) {
      doContentSlide(
        pptx, model, di, chunks[ci]!, ci, tpl,
        ci === 0 && hasImg ? image : null,
        params.subject, slideNum, totalPhysical, layahLogo, schoolLogo, ctx,
      );
      slideNum++;
    }
  }

  // PowerPoint repairs (or refuses) packages with illegal XML characters or negative shape sizes;
  // normalise whatever the slide content contained before it reaches the teacher.
  return repairPptxPackage((await pptx.write({ outputType: "nodebuffer" })) as Buffer);
}

type EducationalRow = { text: string; kind?: "idea" | "step" | "plain" };

function omitDuplicatedCentralTakeaway(spec: SlideSpec): SlideSpec {
  const takeaway = spec.centralTakeaway?.trim();
  if (!takeaway || !spec.contentBlocks.flatMap(blockText).some((text) => text.trim() === takeaway)) return spec;
  return { ...spec, centralTakeaway: null };
}

function educationalRows(blocks: readonly EducationalContentBlock[]): EducationalRow[] {
  const rows: EducationalRow[] = [];
  const addText = (text: string, kind: EducationalRow["kind"] = "plain") => {
    const parts = text.replace(/\r\n/g, "\n").split(/\n+/).map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.length > 240) {
        const sentences = part.split(/(?<=[.!?؟。])\s+/).filter(Boolean);
        if (sentences.length > 1) rows.push(...sentences.map((sentence) => ({ text: sentence, kind })));
        else rows.push({ text: part, kind });
      } else rows.push({ text: part, kind });
    }
  };
  for (const block of blocks) {
    switch (block.type) {
      case "paragraph": addText(block.text); break;
      case "keyIdea": addText(block.text, "idea"); break;
      case "bulletList": block.items.forEach((item) => addText(item)); break;
      case "orderedSteps": block.items.forEach((item) => addText(item, "step")); break;
      case "workedExample":
        addText(block.prompt, "idea");
        block.steps.forEach((step) => {
          addText(step.work, "step");
          if (step.reasoning) addText(step.reasoning);
        });
        addText(block.result, "idea");
        break;
      case "diagram": break;
      case "comparison": break;
      case "task": block.instructions.forEach((item) => addText(item, "step")); break;
      case "question":
        addText(block.prompt, "idea");
        block.options?.forEach((option) => addText(option.text));
        break;
      case "reflection":
        block.prompts.forEach((prompt) => addText(prompt, "idea"));
        block.sentenceStarters?.forEach((starter) => addText(starter));
        break;
    }
  }
  return rows;
}

function addEducationalPanel(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  box: { x: number; y: number; w: number; h: number },
  tokens: ReturnType<typeof getPptDesignTokens>,
  options: { fill?: string; border?: boolean; radius?: boolean } = {},
): void {
  slide.addShape(options.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
    ...box,
    rectRadius: options.radius ? 0.08 : 0,
    fill: { color: options.fill ?? tokens.colors.surface },
    line: { color: options.border === false ? options.fill ?? tokens.colors.surface : tokens.colors.rule, pt: options.border === false ? 0 : 0.8 },
  });
}

function addEducationalText(
  slide: PptxGenJS.Slide,
  text: string,
  box: { x: number; y: number; w: number; h: number },
  tokens: ReturnType<typeof getPptDesignTokens>,
  options: { fontSize?: number; minimumFont?: number; bold?: boolean; color?: string; align?: "left" | "center" | "right"; valign?: "top" | "mid" | "middle" | "bottom"; margin?: number; fill?: string } = {},
): void {
  let fontSize = options.fontSize ?? tokens.type.body;
  const minimumFont = options.minimumFont ?? tokens.type.minimumBody;
  while (fontSize > minimumFont && !textFitsRegion(text, box, fontSize)) fontSize -= 1;
  if (!textFitsRegion(text, box, fontSize)) {
    throw new Error(`Educational slide text does not fit its assigned region at the ${minimumFont} pt minimum: "${text.slice(0, 80)}".`);
  }
  const rtlOpts = directionOptions(tokens.rtl);
  slide.addText(text, {
    ...box,
    ...(options.fill ? { fill: { color: options.fill } } : {}),
    margin: options.margin ?? 0,
    fontFace: tokens.fontFace,
    fontSize,
    bold: options.bold ?? false,
    color: options.color ?? tokens.colors.text,
    align: options.align ?? (tokens.rtl ? "right" : "left"),
    valign: options.valign === "mid" ? "middle" : options.valign ?? "top",
    breakLine: false,
    lineSpacingMultiple: tokens.type.lineHeight,
    ...rtlOpts,
  });
}

type EducationalRowOptions = {
  fontSize?: number;
  /** Descending font candidates; the largest that fits wins, the last is the hard minimum. Overrides fontSize. */
  fonts?: readonly number[];
  numbered?: boolean;
  checklist?: boolean;
  gap?: number;
  /** Grow row gaps (up to maxGap) so the block uses the region; center it vertically when set. */
  spread?: { maxGap: number; center?: boolean };
  /** Hairline between rows, drawn in the gap. */
  rules?: boolean;
};

function addEducationalRows(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  rows: readonly EducationalRow[],
  box: { x: number; y: number; w: number; h: number },
  tokens: ReturnType<typeof getPptDesignTokens>,
  options: EducationalRowOptions = {},
): void {
  if (rows.length === 0) return;
  const numbered = options.numbered ?? false;
  const checklist = options.checklist ?? false;
  const baseGap = options.gap ?? 0.16;
  const candidates = options.fonts?.length ? options.fonts : [options.fontSize ?? tokens.type.body];
  const layout = (fontSize: number) => {
    const markerSize = Math.min(0.5, Math.max(0.32, (fontSize / 72) * 1.35));
    const bulleted = !numbered && !checklist && rows.some((row) => row.kind === "step");
    const markerW = numbered || checklist ? markerSize + 0.16 : bulleted ? 0.34 : 0;
    const contentW = box.w - markerW;
    const estimated = rows.map((row) => Math.max(markerSize + 0.02, estimateTextHeight(row.text, Math.max(1, contentW), fontSize)));
    const total = estimated.reduce((sum, h) => sum + h, 0) + baseGap * Math.max(0, rows.length - 1);
    return { fontSize, markerSize, markerW, contentW, estimated, total };
  };
  let chosen = layout(candidates[candidates.length - 1]!);
  for (const candidate of candidates) {
    const attempt = layout(candidate);
    if (attempt.total <= box.h + 0.04) { chosen = attempt; break; }
  }
  const { fontSize, markerSize, markerW, contentW, estimated, total } = chosen;
  if (total > box.h + 0.04) {
    throw new Error(`Educational composition needs ${total.toFixed(2)} in for ${rows.length} content rows, but only ${box.h.toFixed(2)} in is available.`);
  }
  let rowGap = baseGap;
  let y = box.y;
  if (options.spread && rows.length > 1) {
    rowGap = Math.min(options.spread.maxGap, baseGap + (box.h - total) / (rows.length - 1));
  }
  if (options.spread?.center) {
    const used = total - baseGap * Math.max(0, rows.length - 1) + rowGap * Math.max(0, rows.length - 1);
    y += Math.max(0, (box.h - used) / 2);
  }
  const contentX = tokens.rtl ? box.x : box.x + markerW;
  rows.forEach((row, index) => {
    const rowH = estimated[index]!;
    // RTL mirrors the LTR gutter: marker flush to the right edge, text ending one gap before it.
    const markerX = tokens.rtl ? (numbered || checklist ? box.x + box.w - markerSize - 0.03 : box.x + box.w - markerW + 0.06) : box.x;
    const markerY = y + 0.02;
    if (numbered) {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: markerX, y: markerY, w: markerSize, h: markerSize,
        fill: { color: tokens.colors.accent }, line: { color: tokens.colors.accent },
      });
      slide.addText(String(index + 1), {
        x: markerX, y: markerY, w: markerSize, h: markerSize, margin: 0,
        fontFace: tokens.fontFace, fontSize: Math.round(markerSize * 37.5), bold: true, color: tokens.colors.accentText,
        align: "center", valign: "middle",
      });
    } else if (checklist) {
      const boxSize = markerSize * 0.78;
      slide.addShape(pptx.ShapeType.rect, {
        x: markerX + 0.03, y: markerY + (markerSize - boxSize) / 2, w: boxSize, h: boxSize,
        fill: { color: tokens.colors.background, transparency: 100 }, line: { color: tokens.colors.positive, pt: 1.4 },
      });
    } else if (row.kind === "step") {
      slide.addShape(pptx.ShapeType.rect, {
        x: markerX + 0.13, y: y + 0.13, w: 0.12, h: 0.12,
        fill: { color: tokens.colors.accent }, line: { color: tokens.colors.accent },
      });
    }
    addEducationalText(slide, row.text, { x: contentX, y, w: contentW, h: rowH }, tokens, {
      fontSize: row.kind === "idea" ? Math.min(tokens.type.section, fontSize + 2) : fontSize,
      minimumFont: tokens.type.minimumBody,
      bold: row.kind === "idea",
      color: tokens.colors.text,
    });
    if (options.rules && index < rows.length - 1) {
      const ruleY = y + rowH + rowGap / 2;
      slide.addShape(pptx.ShapeType.line, { x: box.x, y: ruleY, w: box.w, h: 0, line: { color: tokens.colors.rule, pt: 0.75 } });
    }
    y += rowH + rowGap;
  });
}

function addEducationalHeader(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  tpl: TemplateConfig,
  tokens: ReturnType<typeof getPptDesignTokens>,
  subject: string,
  slideNum: number,
  total: number,
  logo: string | null,
  schoolLogo: string | null,
): void {
  slide.background = { color: tokens.colors.background };
  const titleBox = { x: PPT_GRID.safe.left, y: PPT_GRID.title.y, w: PPT_GRID.width - PPT_GRID.safe.left - PPT_GRID.safe.right, h: PPT_GRID.title.h };
  addEducationalText(slide, spec.title, titleBox, tokens, { fontSize: tokens.type.title, minimumFont: 22, bold: true, color: tokens.colors.text, valign: "mid" });
  slide.addShape(pptx.ShapeType.line, {
    x: PPT_GRID.safe.left, y: 1.32, w: PPT_GRID.width - PPT_GRID.safe.left - PPT_GRID.safe.right, h: 0,
    line: { color: tokens.colors.rule, pt: 0.9 },
  });
  addFooter(pptx, slide, tpl, tokens.fontFace, subject, slideNum, total, logo);
  if (schoolLogo) addSchoolLogo(pptx, slide, schoolLogo);
}

function addEducationalImage(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  image: ImageAsset | null,
  region: { x: number; y: number; w: number; h: number },
  tpl: TemplateConfig,
  altText: string,
): void {
  if (!image) return;
  drawRoundedImageFrame(pptx, slide, {
    ...region,
    imageDataUri: image.dataUri,
    naturalWidth: image.width,
    naturalHeight: image.height,
    tpl,
    altText,
  });
}

function addTakeaway(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  text: string,
  box: { x: number; y: number; w: number; h: number },
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  addEducationalPanel(pptx, slide, box, tokens, { fill: tokens.colors.accentSoft, border: false });
  const barX = tokens.rtl ? box.x + box.w - 0.06 : box.x;
  slide.addShape(pptx.ShapeType.rect, { x: barX, y: box.y, w: 0.06, h: box.h, fill: { color: tokens.colors.accent }, line: { color: tokens.colors.accent } });
  addEducationalText(slide, text, {
    x: box.x + (tokens.rtl ? 0.28 : 0.28), y: box.y + 0.16, w: box.w - 0.56, h: box.h - 0.32,
  }, tokens, { fontSize: tokens.type.section, bold: true, valign: "mid" });
}

/** Y coordinate where body content starts when there is no lead text. */
const BODY_TOP = 1.72;
/** Bottom of the usable body area, above the footer rule. */
const BODY_BOTTOM = 6.58;

/**
 * Draws the central takeaway as a quiet accent-ruled line sized to its text and returns the y at
 * which the body should start. Long takeaways grow downward instead of overflowing a fixed strip.
 */
function addTopTakeaway(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  text: string | null,
  tokens: ReturnType<typeof getPptDesignTokens>,
): number {
  if (!text) return BODY_TOP;
  const w = 11.46;
  const h = Math.max(0.42, estimateTextHeight(text, w, 20) + 0.08);
  const box = { x: 0.82, y: 1.48, w: 11.7, h };
  const edgeX = tokens.rtl ? box.x + box.w - 0.045 : box.x;
  slide.addShape(pptx.ShapeType.line, { x: edgeX, y: box.y + 0.04, w: 0, h: box.h - 0.08, line: { color: tokens.colors.accent, pt: 2.2 } });
  addEducationalText(slide, text, { x: box.x + 0.12, y: box.y, w, h: box.h }, tokens, { fontSize: 20, minimumFont: 16, bold: true, color: tokens.colors.accent, valign: "mid" });
  return Math.max(2.0, box.y + h + 0.24);
}

/**
 * Draws a takeaway plus supporting text rows as a compact lead block sized to their content and
 * returns the y at which the body may start.
 */
function addLeadRows(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  rows: readonly EducationalRow[],
  tokens: ReturnType<typeof getPptDesignTokens>,
): number {
  if (rows.length === 0) return BODY_TOP;
  const w = 11.68;
  const h = rows.reduce((sum, row) => sum + Math.max(0.34, estimateTextHeight(row.text, w, 15)), 0) + 0.04 * (rows.length - 1);
  addEducationalRows(pptx, slide, rows, { x: 0.82, y: 1.46, w, h }, tokens, { fontSize: 15, gap: 0.04 });
  return 1.46 + h + 0.22;
}

function renderOpeningComposition(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  deck: DeckSpec,
  image: ImageAsset | null,
  tpl: TemplateConfig,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  spec = omitDuplicatedCentralTakeaway(spec);
  const main = tokens.rtl ? { x: 6.3, y: 1.65, w: 6.3, h: 2.15 } : { x: 0.75, y: 1.65, w: 7.0, h: 2.15 };
  const imageBox = tokens.rtl ? { x: 0.75, y: 1.76, w: 4.75, h: 4.65 } : { x: 8.1, y: 1.76, w: 4.5, h: 4.65 };
  const subtitle = [deck.subject, deck.grade, deck.topic].filter(Boolean).join("  ·  ");
  addEducationalText(slide, deck.topic?.trim() || spec.title, main, tokens, { fontSize: 36, minimumFont: 26, bold: true, color: tokens.colors.text, valign: "mid" });
  slide.addShape(pptx.ShapeType.line, { x: main.x, y: 4.02, w: Math.min(main.w * 0.58, 3.8), h: 0, line: { color: tokens.colors.accent, pt: 3 } });
  addEducationalText(slide, subtitle, { x: main.x, y: 4.25, w: main.w, h: 0.72 }, tokens, { fontSize: 18, color: tokens.colors.mutedText, valign: "top" });
  const rows: EducationalRow[] = [
    ...(spec.centralTakeaway ? [{ text: spec.centralTakeaway, kind: "idea" as const }] : []),
    ...educationalRows(spec.contentBlocks),
  ];
  const metadata = new Set([deck.subject.trim(), deck.grade.trim(), deck.topic?.trim() ?? ""].filter(Boolean));
  const extraRows = rows.filter((row) => !metadata.has(row.text.trim()));
  if (extraRows.length) addEducationalRows(pptx, slide, extraRows, { x: main.x, y: 5.15, w: main.w, h: 1.24 }, tokens, { fontSize: 15, gap: 0.06 });
  if (spec.image?.url && spec.layoutIntent.image !== "avoid") addEducationalImage(pptx, slide, image, mirrorRegion(imageBox, tokens.rtl), tpl, spec.image.altText ?? "Lesson illustration");
}

function renderConceptFocus(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  image: ImageAsset | null,
  tpl: TemplateConfig,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const definition = getCompositionDefinition("concept-focus");
  const useImage = Boolean(image && spec.image && spec.layoutIntent.image !== "avoid");
  const contentBox = useImage ? { x: 0.78, y: 1.68, w: 7.0, h: 4.92 } : { x: 0.78, y: 1.68, w: 11.72, h: 4.92 };
  const rows = educationalRows(spec.contentBlocks);
  const lead = spec.centralTakeaway ?? rows[0]?.text ?? "";
  const remainder = spec.centralTakeaway ? rows : rows.slice(1);
  if (lead) addTakeaway(pptx, slide, lead, { x: contentBox.x, y: contentBox.y, w: contentBox.w, h: 1.78 }, tokens);
  const supportBox = { x: contentBox.x, y: contentBox.y + 2.06, w: contentBox.w, h: 2.74 };
  addEducationalRows(pptx, slide, remainder, supportBox, tokens, { fontSize: tokens.type.body, gap: 0.14 });
  if (useImage && image) {
    const imageRegion = mirrorRegion(definition.regions.image, tokens.rtl);
    addEducationalImage(pptx, slide, image, imageRegion, tpl, spec.image?.altText ?? "Supporting lesson image");
  }
}

function renderDefinitionExample(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const panelY = addTopTakeaway(pptx, slide, spec.centralTakeaway, tokens);
  const panelH = BODY_BOTTOM - panelY;
  const left = mirrorRegion({ x: 0.78, y: panelY, w: 4.3, h: panelH }, tokens.rtl);
  const right = mirrorRegion({ x: 5.5, y: panelY, w: 7.0, h: panelH }, tokens.rtl);
  addEducationalPanel(pptx, slide, left, tokens, { fill: tokens.colors.surfaceAlt, border: false });
  const definitionLabel = tokens.rtl ? "الفكرة الأساسية" : "Core idea";
  const exampleLabel = tokens.rtl ? "مثال" : "Example";
  addEducationalText(slide, definitionLabel, { x: left.x + 0.24, y: left.y + 0.22, w: left.w - 0.48, h: 0.42 }, tokens, { fontSize: 15, color: tokens.colors.accent, bold: true, valign: "mid" });
  const worked = spec.contentBlocks.find((block) => block.type === "workedExample");
  const rows = educationalRows(spec.contentBlocks.filter((block) => block.type !== "workedExample"));
  const definitionRows = worked ? rows : rows.slice(0, 1);
  const exampleRows = worked ? [] : rows.slice(1);
  addEducationalRows(pptx, slide, definitionRows, { x: left.x + 0.24, y: left.y + 0.84, w: left.w - 0.48, h: left.h - 1.08 }, tokens, { fontSize: 17, gap: 0.14 });
  addEducationalText(slide, exampleLabel, { x: right.x + 0.24, y: right.y + 0.22, w: right.w - 0.48, h: 0.42 }, tokens, { fontSize: 15, color: tokens.colors.accent, bold: true, valign: "mid" });
  if (worked?.type === "workedExample") {
    addWorkedExample(pptx, slide, worked, { x: right.x + 0.24, y: right.y + 0.78, w: right.w - 0.48, h: right.h - 1.0 }, tokens, true);
  } else {
    addEducationalRows(pptx, slide, exampleRows, { x: right.x + 0.24, y: right.y + 0.84, w: right.w - 0.48, h: right.h - 1.08 }, tokens, { fontSize: 17, numbered: true });
  }
}

function addWorkedExample(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  block: Extract<EducationalContentBlock, { type: "workedExample" }>,
  box: { x: number; y: number; w: number; h: number },
  tokens: ReturnType<typeof getPptDesignTokens>,
  showPrompt = true,
): void {
  if (showPrompt) addEducationalText(slide, block.prompt, { x: box.x, y: box.y, w: box.w, h: 0.92 }, tokens, { fontSize: 20, minimumFont: 16, bold: true, valign: "mid" });
  const stepY = box.y + (showPrompt ? 1.06 : 0.08);
  const resultH = 0.66;
  const stepsH = box.y + box.h - resultH - stepY - 0.16;
  const stepRows = block.steps.map((step) => ({ text: [step.work, ...(step.reasoning ? [step.reasoning] : [])].join("  —  "), kind: "step" as const }));
  addEducationalRows(pptx, slide, stepRows, { x: box.x, y: stepY, w: box.w, h: stepsH }, tokens, { fontSize: 16, numbered: true, gap: 0.1 });
  const resultY = box.y + box.h - resultH;
  addEducationalPanel(pptx, slide, { x: box.x, y: resultY, w: box.w, h: resultH }, tokens, { fill: tokens.colors.accentSoft, border: false });
  addEducationalText(slide, block.result, { x: box.x + 0.2, y: resultY + 0.08, w: box.w - 0.4, h: resultH - 0.16 }, tokens, { fontSize: 17, bold: true, valign: "mid" });
}

function renderWorkedExample(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const workedBlocks = spec.contentBlocks.filter((content): content is Extract<EducationalContentBlock, { type: "workedExample" }> => content.type === "workedExample");
  if (workedBlocks.length > 1) throw new Error(`Slide "${spec.title}" needs one worked example per physical slide.`);
  const block = workedBlocks[0];
  if (block) {
    const otherRows = educationalRows(spec.contentBlocks.filter((content) => content.type !== "workedExample"));
    const topRows = [
      ...(spec.centralTakeaway ? [{ text: spec.centralTakeaway, kind: "idea" as const }] : []),
      ...otherRows,
    ];
    const bodyY = topRows.length ? addLeadRows(pptx, slide, topRows, tokens) : 1.66;
    const region = mirrorRegion({ x: 0.78, y: bodyY, w: 11.75, h: BODY_BOTTOM + 0.04 - bodyY }, tokens.rtl);
    addWorkedExample(pptx, slide, block, region, tokens);
    return;
  }
  const box = mirrorRegion({ x: 0.82, y: 1.75, w: 11.65, h: 4.9 }, tokens.rtl);
  addEducationalRows(pptx, slide, educationalRows(spec.contentBlocks), box, tokens, { fontSize: 18, numbered: true, gap: 0.18 });
}

/** Orders nodes along their connections (sources first, following edges) so flows read left to right and edges rarely cross. */
function orderNodesForFlow(
  nodes: readonly { id: string; label: string; kind?: string }[],
  connections: readonly { from: string; to: string }[],
): { id: string; label: string; kind?: string }[] {
  const incoming = new Set(connections.map((connection) => connection.to));
  const visited = new Set<string>();
  const ordered: { id: string; label: string; kind?: string }[] = [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visit = (id: string) => {
    if (visited.has(id) || !byId.has(id)) return;
    visited.add(id);
    ordered.push(byId.get(id)!);
    connections.filter((connection) => connection.from === id).forEach((connection) => visit(connection.to));
  };
  nodes.filter((node) => !incoming.has(node.id)).forEach((node) => visit(node.id));
  nodes.forEach((node) => visit(node.id));
  return ordered;
}

/** Groups nodes into columns by longest path from the sources; null when there are no connections to rank by. */
function connectionLayers<T extends { id: string }>(
  ordered: readonly T[],
  connections: readonly { from: string; to: string }[],
): T[][] | null {
  if (connections.length === 0) return null;
  const rank = new Map(ordered.map((node) => [node.id, 0]));
  for (let pass = 0; pass < ordered.length; pass += 1) {
    let changed = false;
    for (const connection of connections) {
      const from = rank.get(connection.from), to = rank.get(connection.to);
      if (from === undefined || to === undefined || to >= from + 1 || from + 1 > ordered.length - 1) continue;
      rank.set(connection.to, from + 1);
      changed = true;
    }
    if (!changed) break;
  }
  const layers: T[][] = [];
  ordered.forEach((node) => {
    const index = rank.get(node.id)!;
    (layers[index] ??= []).push(node);
  });
  return layers.filter((layer) => layer && layer.length > 0);
}

function renderDiagram(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  block: Extract<EducationalContentBlock, { type: "diagram" }>,
  box: { x: number; y: number; w: number; h: number },
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const count = block.nodes.length;
  if (count > 12 || block.connections.length > 24) {
    throw new Error(`Diagram has ${count} nodes and ${block.connections.length} connections; this composition supports up to 12 nodes and 24 connections per slide.`);
  }
  const labels = block.connections.flatMap((connection) => connection.label ? [connection.label] : []);
  const hasLabels = labels.length > 0;
  // Room between nodes is sized from the longest 15 pt label (capped), so labels sit on the edge they name.
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  const gapX = hasLabels ? Math.min(1.7, Math.max(1.4, longest * 0.105 + 0.35)) : 0.42;
  const gapY = hasLabels ? 1.0 : 0.62;
  const ordered = orderNodesForFlow(block.nodes, block.connections);
  const layers = connectionLayers(ordered, block.connections);
  const positions = new Map<string, EducationalBox>();
  if (layers && layers.length >= 2 && (box.w - gapX * (layers.length - 1)) / layers.length >= 1.5) {
    // Layered layout: columns follow the flow, nodes of the same rank stack in their column.
    const maxRows = Math.max(...layers.map((layer) => layer.length));
    const nodeW = Math.min(2.65, (box.w - gapX * (layers.length - 1)) / layers.length);
    const nodeH = Math.min(1.1, (box.h - gapY * (maxRows - 1)) / maxRows);
    const startX = box.x + (box.w - (layers.length * nodeW + (layers.length - 1) * gapX)) / 2;
    layers.forEach((layer, rank) => {
      const visualCol = tokens.rtl ? layers.length - rank - 1 : rank;
      const columnH = layer.length * nodeH + (layer.length - 1) * gapY;
      const top = box.y + Math.max(0.1, (box.h - columnH) / 2);
      layer.forEach((node, index) => positions.set(node.id, { x: startX + visualCol * (nodeW + gapX), y: top + index * (nodeH + gapY), w: nodeW, h: nodeH }));
    });
  } else {
    let columns = Math.min(4, count);
    while (columns > 2 && (box.w - gapX * (columns - 1)) / columns < 1.5) columns -= 1;
    const rows = Math.ceil(count / columns);
    const nodeW = Math.min(2.65, (box.w - gapX * (columns - 1)) / columns);
    const nodeH = Math.min(1.1, (box.h - gapY * (rows - 1)) / rows);
    const totalH = rows * nodeH + (rows - 1) * gapY;
    const startY = box.y + Math.max(0.1, (box.h - totalH) / 2);
    const startX = box.x + (box.w - (columns * nodeW + (columns - 1) * gapX)) / 2;
    ordered.forEach((node, index) => {
      const logicalCol = index % columns;
      const row = Math.floor(index / columns);
      const visualCol = tokens.rtl ? columns - logicalCol - 1 : logicalCol;
      positions.set(node.id, { x: startX + visualCol * (nodeW + gapX), y: startY + row * (nodeH + gapY), w: nodeW, h: nodeH });
    });
  }
  block.connections.forEach((connection) => {
    const from = positions.get(connection.from);
    const to = positions.get(connection.to);
    if (from && to) addConnector(pptx, slide, from, to, tokens, true);
  });
  block.nodes.forEach((node) => {
    const nodeBox = positions.get(node.id)!;
    addEducationalPanel(pptx, slide, nodeBox, tokens, { fill: node.kind === "central" ? tokens.colors.accentSoft : tokens.colors.surfaceAlt, border: true, radius: true });
    addEducationalText(slide, node.label, { x: nodeBox.x + 0.13, y: nodeBox.y + 0.1, w: nodeBox.w - 0.26, h: nodeBox.h - 0.2 }, tokens, { fontSize: 18, minimumFont: 15, bold: node.kind === "central", align: "center", valign: "mid" });
  });
  // Labels are drawn last so neither the connectors nor the node panels can cover them.
  block.connections.forEach((connection) => {
    const from = positions.get(connection.from);
    const to = positions.get(connection.to);
    if (connection.label && from && to) addConnectorLabel(slide, from, to, connection.label, tokens);
  });
}

function renderLabeledDiagram(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const diagrams = spec.contentBlocks.filter((block): block is Extract<EducationalContentBlock, { type: "diagram" }> => block.type === "diagram");
  if (diagrams.length > 1) throw new Error(`Slide "${spec.title}" needs one diagram per physical slide.`);
  const diagram = diagrams[0];
  if (!diagram) {
    const bodyY = addTopTakeaway(pptx, slide, spec.centralTakeaway, tokens);
    addEducationalRows(pptx, slide, educationalRows(spec.contentBlocks), { x: 0.82, y: bodyY, w: 11.7, h: BODY_BOTTOM - bodyY }, tokens, { fontSize: 18, numbered: true });
    return;
  }
  // Supporting text and the takeaway anchor the bottom; the diagram is centered in the space above.
  const supporting = educationalRows(spec.contentBlocks.filter((block) => block.type !== "diagram"));
  const footerW = 11.4;
  const supportH = supporting.length ? supporting.reduce((sum, row) => sum + Math.max(0.34, estimateTextHeight(row.text, footerW, 15)), 0) + 0.04 * (supporting.length - 1) : 0;
  const takeawayH = spec.centralTakeaway ? Math.max(0.5, estimateTextHeight(spec.centralTakeaway, footerW, 18) + 0.1) : 0;
  const footerH = supportH + takeawayH + (supportH && takeawayH ? 0.1 : 0);
  const footerTop = BODY_BOTTOM - footerH;
  const regionH = (footerH ? footerTop - 0.2 : BODY_BOTTOM) - 1.6;
  if (regionH < 2.4) throw new Error(`Slide "${spec.title}" leaves too little height for its diagram.`);
  renderDiagram(pptx, slide, diagram, mirrorRegion({ x: 0.82, y: 1.6, w: 11.7, h: regionH }, tokens.rtl), tokens);
  let y = footerTop;
  if (supportH) {
    addEducationalRows(pptx, slide, supporting.map((row) => ({ text: row.text })), { x: 0.95, y, w: footerW, h: supportH }, tokens, { fontSize: 15, gap: 0.04 });
    y += supportH + 0.1;
  }
  if (spec.centralTakeaway) addEducationalText(slide, spec.centralTakeaway, { x: 0.95, y, w: footerW, h: takeawayH }, tokens, { fontSize: 18, minimumFont: 16, bold: true, color: tokens.colors.accent, align: "center", valign: "mid" });
}

type EducationalBox = { x: number; y: number; w: number; h: number };

/**
 * Connector geometry between two node boxes: the segment is clipped to the box edges (so arrowheads
 * land on the target instead of hiding under it) and the exposed middle is where a label belongs.
 */
function edgeGeometry(from: EducationalBox, to: EducationalBox): {
  sx: number; sy: number; ex: number; ey: number; mx: number; my: number; exposed: number; horizontal: boolean;
} | null {
  const x1 = from.x + from.w / 2, y1 = from.y + from.h / 2;
  const x2 = to.x + to.w / 2, y2 = to.y + to.h / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const exitFraction = (box: EducationalBox) => Math.min(
    dx === 0 ? Infinity : box.w / 2 / Math.abs(dx),
    dy === 0 ? Infinity : box.h / 2 / Math.abs(dy),
  );
  const t0 = exitFraction(from) + 0.01;
  const t1 = 1 - exitFraction(to) - 0.01;
  if (t1 <= t0) return null;
  const tm = (t0 + t1) / 2;
  return {
    sx: x1 + dx * t0, sy: y1 + dy * t0, ex: x1 + dx * t1, ey: y1 + dy * t1,
    mx: x1 + dx * tm, my: y1 + dy * tm,
    exposed: (t1 - t0) * Math.hypot(dx, dy),
    horizontal: Math.abs(dx) >= Math.abs(dy),
  };
}

function addConnector(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  from: EducationalBox,
  to: EducationalBox,
  tokens: ReturnType<typeof getPptDesignTokens>,
  arrow: boolean,
): void {
  const geometry = edgeGeometry(from, to);
  if (!geometry) return;
  const { sx, sy, ex, ey } = geometry;
  slide.addShape(pptx.ShapeType.line, {
    x: Math.min(sx, ex), y: Math.min(sy, ey), w: Math.max(0.01, Math.abs(ex - sx)), h: Math.max(0.01, Math.abs(ey - sy)),
    flipH: ex < sx, flipV: ey < sy,
    line: { color: tokens.colors.accent, pt: 1.5, ...(arrow ? { endArrowType: "triangle" as const } : {}) },
  });
}

/** Edge labels stay at 15 pt: they wrap inside the exposed edge length, above (or beside) the line. */
function addConnectorLabel(
  slide: PptxGenJS.Slide,
  from: EducationalBox,
  to: EducationalBox,
  label: string,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const geometry = edgeGeometry(from, to);
  if (!geometry) throw new Error(`Diagram nodes are too close to draw the "${label.slice(0, 30)}" connection label legibly.`);
  const font = 15;
  const slope = Math.abs(geometry.ey - geometry.sy) / Math.max(0.01, Math.abs(geometry.ex - geometry.sx));
  if (geometry.horizontal && slope > 0.12) {
    // Sloped edge: a background-colored chip centered on the line keeps the label legible without a strike-through.
    const w = Math.min(2.2, Math.max(0.9, label.length * 0.105 + 0.2));
    const h = Math.max(0.3, estimateTextHeight(label, w, font) + 0.04);
    addEducationalText(slide, label, { x: geometry.mx - w / 2, y: geometry.my - h / 2, w, h }, tokens, { fontSize: font, minimumFont: font, color: tokens.colors.accent, bold: true, align: "center", valign: "mid", fill: tokens.colors.background });
  } else if (geometry.horizontal) {
    const w = Math.max(0.9, Math.min(2.4, geometry.exposed - 0.08));
    const h = Math.max(0.3, estimateTextHeight(label, w, font) + 0.04);
    addEducationalText(slide, label, { x: geometry.mx - w / 2, y: geometry.my - h - 0.04, w, h }, tokens, { fontSize: font, minimumFont: font, color: tokens.colors.accent, bold: true, align: "center", valign: "bottom" });
  } else {
    const w = 1.7;
    const h = Math.max(0.3, estimateTextHeight(label, w, font) + 0.04);
    const alignRight = tokens.rtl;
    addEducationalText(slide, label, { x: alignRight ? geometry.mx - 0.1 - w : geometry.mx + 0.1, y: geometry.my - h / 2, w, h }, tokens, { fontSize: font, minimumFont: font, color: tokens.colors.accent, bold: true, align: alignRight ? "right" : "left", valign: "mid" });
  }
}

/** Balanced node slots around a central node for 1–8 satellites, mirrored for RTL. */
function summaryMapSlots(count: number, map: EducationalBox, rtl: boolean): EducationalBox[] | null {
  const nodeW = 2.6, nodeH = 0.95;
  const left = map.x + 0.3, right = map.x + map.w - 0.3 - nodeW, centerX = map.x + (map.w - nodeW) / 2;
  const top = map.y + 0.05, bottom = map.y + map.h - nodeH - 0.05, middle = map.y + (map.h - nodeH) / 2;
  const at = (x: number, y: number): EducationalBox => ({ x, y, w: nodeW, h: nodeH });
  const TL = at(left, top), TR = at(right, top), ML = at(left, middle), MR = at(right, middle);
  const BL = at(left, bottom), BR = at(right, bottom), TC = at(centerX, top), BC = at(centerX, bottom);
  const presets: Record<number, EducationalBox[]> = {
    1: [MR], 2: [ML, MR], 3: [TL, TR, BC], 4: [TL, TR, BL, BR], 5: [TL, TR, BL, BR, BC],
    6: [TL, TR, ML, MR, BL, BR], 7: [TL, TR, ML, MR, BL, BR, TC], 8: [TL, TR, ML, MR, BL, BR, TC, BC],
  };
  const slots = presets[count];
  return slots ? slots.map((slot) => mirrorRegion(slot, rtl)) : null;
}

function renderSummaryMapDiagram(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  block: Extract<EducationalContentBlock, { type: "diagram" }>,
  map: EducationalBox,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const centerIndex = Math.max(0, block.nodes.findIndex((node) => node.kind === "central"));
  const centerNode = block.nodes[centerIndex]!;
  // A hub layout only works when every relationship touches the hub; otherwise straight spokes would
  // run through it and mislead, so the diagram is laid out as a connected grid instead.
  const radial = block.connections.every((connection) => connection.from === centerNode.id || connection.to === centerNode.id);
  if (!radial) {
    renderDiagram(pptx, slide, block, map, tokens);
    return;
  }
  const satellites = block.nodes.filter((_, index) => index !== centerIndex);
  const slots = summaryMapSlots(satellites.length, map, tokens.rtl);
  if (!slots && satellites.length > 0) throw new Error(`Summary map supports up to 8 satellite nodes; this diagram has ${satellites.length}.`);
  const centerBox = { x: map.x + (map.w - 3.3) / 2, y: map.y + (map.h - 1.25) / 2, w: 3.3, h: 1.25 };
  const positions = new Map<string, EducationalBox>([[centerNode.id, centerBox]]);
  satellites.forEach((node, index) => positions.set(node.id, slots![index]!));
  const explicit = block.connections.length > 0;
  const edges: { from: string; to: string; label?: string }[] = explicit
    ? block.connections
    : satellites.map((node) => ({ from: centerNode.id, to: node.id }));
  edges.forEach((edge) => {
    const from = positions.get(edge.from), to = positions.get(edge.to);
    if (from && to) addConnector(pptx, slide, from, to, tokens, explicit);
  });
  block.nodes.forEach((node) => {
    const box = positions.get(node.id)!;
    const central = node.id === centerNode.id;
    addEducationalPanel(pptx, slide, box, tokens, { fill: central ? tokens.colors.accentSoft : tokens.colors.surfaceAlt, border: !central, radius: true });
    addEducationalText(slide, node.label, { x: box.x + 0.14, y: box.y + 0.08, w: box.w - 0.28, h: box.h - 0.16 }, tokens, { fontSize: central ? 18 : 16, minimumFont: 15, bold: central, align: "center", valign: "mid" });
  });
  edges.forEach((edge) => {
    const from = positions.get(edge.from), to = positions.get(edge.to);
    if (edge.label && from && to) addConnectorLabel(slide, from, to, edge.label, tokens);
  });
}

function renderSummaryMap(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const diagram = spec.contentBlocks.find((block): block is Extract<EducationalContentBlock, { type: "diagram" }> => block.type === "diagram");
  const mapTop = 1.6;
  if (diagram) {
    // The takeaway anchors the bottom of the slide; the map takes the space above it.
    const supporting = educationalRows(spec.contentBlocks.filter((block) => block.type !== "diagram"));
    const footerW = 11.4;
    const supportH = supporting.length ? supporting.reduce((sum, row) => sum + Math.max(0.34, estimateTextHeight(row.text, footerW, 15)), 0) + 0.04 * (supporting.length - 1) : 0;
    const takeawayH = spec.centralTakeaway ? Math.max(0.5, estimateTextHeight(spec.centralTakeaway, footerW, 20) + 0.1) : 0;
    const footerH = supportH + takeawayH + (supportH && takeawayH ? 0.1 : 0);
    const footerTop = BODY_BOTTOM - footerH;
    const map = { x: 0.56, y: mapTop, w: 12.22, h: (footerH ? footerTop - 0.22 : BODY_BOTTOM) - mapTop };
    if (map.h < 3.3) throw new Error("Summary map has too little vertical space left after its supporting text.");
    renderSummaryMapDiagram(pptx, slide, diagram, map, tokens);
    let y = footerTop;
    if (supportH) {
      addEducationalRows(pptx, slide, supporting.map((row) => ({ text: row.text })), { x: 0.96, y, w: footerW, h: supportH }, tokens, { fontSize: 15, gap: 0.04 });
      y += supportH + 0.1;
    }
    if (spec.centralTakeaway) addEducationalText(slide, spec.centralTakeaway, { x: 0.96, y, w: footerW, h: takeawayH }, tokens, { fontSize: 20, minimumFont: 18, bold: true, color: tokens.colors.accent, align: "center", valign: "mid" });
    return;
  }
  const rows = educationalRows(spec.contentBlocks);
  const centerText = spec.centralTakeaway ?? rows[0]?.text ?? "";
  const children = spec.centralTakeaway ? rows : rows.slice(1);
  const map = { x: 0.56, y: mapTop, w: 12.22, h: BODY_BOTTOM - mapTop };
  const slots = summaryMapSlots(children.length, map, tokens.rtl);
  if (!slots && children.length > 0) throw new Error(`Summary map supports up to 8 supporting points; this slide has ${children.length}.`);
  const centerBox = { x: map.x + (map.w - 3.5) / 2, y: map.y + (map.h - 1.4) / 2, w: 3.5, h: 1.4 };
  (slots ?? []).forEach((slot) => addConnector(pptx, slide, centerBox, slot, tokens, false));
  addEducationalPanel(pptx, slide, centerBox, tokens, { fill: tokens.colors.accentSoft, border: false, radius: true });
  addEducationalText(slide, centerText, { x: centerBox.x + 0.2, y: centerBox.y + 0.12, w: centerBox.w - 0.4, h: centerBox.h - 0.24 }, tokens, { fontSize: 20, minimumFont: 17, bold: true, align: "center", valign: "mid" });
  children.forEach((child, index) => {
    const box = slots![index]!;
    addEducationalPanel(pptx, slide, box, tokens, { fill: tokens.colors.surfaceAlt, border: true, radius: true });
    addEducationalText(slide, child.text, { x: box.x + 0.14, y: box.y + 0.08, w: box.w - 0.28, h: box.h - 0.16 }, tokens, { fontSize: 16, minimumFont: 15, align: "center", valign: "mid" });
  });
}

function renderProcessFlow(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const ordered = spec.contentBlocks.filter((block): block is Extract<EducationalContentBlock, { type: "orderedSteps" }> => block.type === "orderedSteps");
  const tasks = spec.contentBlocks.filter((block): block is Extract<EducationalContentBlock, { type: "task" }> => block.type === "task");
  const steps = [...ordered.flatMap((block) => block.items), ...tasks.flatMap((block) => block.instructions)];
  const otherRows = educationalRows(spec.contentBlocks.filter((block) => block.type !== "orderedSteps" && block.type !== "task"));
  const topRows = [
    ...(spec.centralTakeaway ? [{ text: spec.centralTakeaway, kind: "idea" as const }] : []),
    ...otherRows,
  ];
  const topW = 11.68;
  const topH = topRows.length
    ? topRows.reduce((sum, row) => sum + Math.max(0.34, estimateTextHeight(row.text, topW, 15)), 0) + 0.02 * (topRows.length - 1)
    : 0;
  if (topRows.length) addEducationalRows(pptx, slide, topRows, { x: 0.82, y: 1.46, w: topW, h: topH }, tokens, { fontSize: 15, gap: 0.02 });
  const bodyY = topRows.length ? 1.46 + topH + 0.2 : 1.74;
  const bodyH = 6.82 - bodyY;
  const logistics = [
    ...tasks.flatMap((block) => block.timeMinutes ? [`${block.timeMinutes} min`] : []),
    ...tasks.flatMap((block) => block.materials ?? []),
  ];
  const logisticsH = logistics.length ? 0.5 : 0;
  // Short sequences read as a left-to-right flow; longer or wordier ones fall back to numbered rows.
  const cols = steps.length;
  const cardW = (11.7 - 0.45 * Math.max(0, cols - 1)) / Math.max(1, cols);
  const maxCardH = Math.min(bodyH - 0.5 - logisticsH, 3.2);
  const cardH = Math.min(maxCardH, Math.max(1.4, ...steps.map((text) => estimateTextHeight(text, cardW - 0.3, 16) + 0.5)));
  const flowFits = cols >= 2 && cols <= 4 && steps.every((text) => estimateTextHeight(text, cardW - 0.3, 16) <= cardH - 0.3);
  if (!flowFits) {
    const rows = [...steps.map((text) => ({ text, kind: "step" as const })), ...(logistics.length ? [{ text: logistics.join(" · "), kind: "plain" as const }] : [])];
    addEducationalRows(pptx, slide, rows, { x: 0.82, y: bodyY, w: 11.7, h: bodyH }, tokens, { fontSize: 17, numbered: true, gap: 0.16 });
    return;
  }
  steps.forEach((text, index) => {
    const visual = tokens.rtl ? cols - index - 1 : index;
    const x = 0.82 + visual * (cardW + 0.45);
    addEducationalPanel(pptx, slide, { x, y: bodyY + 0.5, w: cardW, h: cardH }, tokens, { fill: tokens.colors.surfaceAlt, border: true });
    slide.addShape(pptx.ShapeType.ellipse, { x, y: bodyY, w: 0.42, h: 0.42, fill: { color: tokens.colors.accent }, line: { color: tokens.colors.accent } });
    slide.addText(String(index + 1), { x, y: bodyY, w: 0.42, h: 0.42, margin: 0, fontFace: tokens.fontFace, fontSize: 14, bold: true, color: tokens.colors.accentText, align: "center", valign: "middle" });
    addEducationalText(slide, text, { x: x + 0.15, y: bodyY + 0.65, w: cardW - 0.3, h: cardH - 0.3 }, tokens, { fontSize: 16, minimumFont: 15 });
    if (index < cols - 1) {
      const ax = tokens.rtl ? x - 0.41 : x + cardW + 0.04;
      slide.addShape(pptx.ShapeType.line, { x: ax, y: bodyY + 0.5 + cardH / 2, w: 0.37, h: 0.01, flipH: tokens.rtl, line: { color: tokens.colors.accent, pt: 1.75, endArrowType: "triangle" } });
    }
  });
  if (logistics.length) addEducationalText(slide, logistics.join(" · "), { x: 0.82, y: bodyY + 0.5 + cardH + 0.2, w: 11.7, h: 0.4 }, tokens, { fontSize: 15, minimumFont: 15, color: tokens.colors.mutedText });
}

function renderComparison(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  block: Extract<EducationalContentBlock, { type: "comparison" }>,
  tokens: ReturnType<typeof getPptDesignTokens>,
  box: { x: number; y: number; w: number; h: number } = { x: 0.76, y: 1.6, w: 11.8, h: 5.0 },
): void {
  if (block.items.length > 3) {
    throw new Error(`Comparison has ${block.items.length} items; compare at most three items on one slide.`);
  }
  const labelW = Math.min(2.8, box.w * 0.24);
  const itemW = (box.w - labelW) / Math.max(1, block.items.length);
  const headerH = 0.6;
  const rowH = (box.h - headerH) / Math.max(1, block.criteria.length);
  const fits = block.criteria.every((criterion, row) =>
    estimateTextHeight(criterion, labelW - 0.24, 15) <= rowH - 0.2 &&
    block.items.every((item) => estimateTextHeight(item.values[row] ?? "", itemW - 0.24, 15) <= rowH - 0.2));
  if (!fits) throw new Error("Comparison cells do not fit at the 15 pt minimum; split the comparison across slides.");
  block.items.forEach((item, col) => {
    const visualCol = tokens.rtl ? block.items.length - col - 1 : col;
    const region = { x: tokens.rtl ? box.x + visualCol * itemW : box.x + labelW + col * itemW, y: box.y, w: itemW, h: headerH };
    addEducationalPanel(pptx, slide, region, tokens, { fill: tokens.colors.accent, border: false });
    addEducationalText(slide, item.label, { x: region.x + 0.12, y: box.y + 0.08, w: region.w - 0.24, h: headerH - 0.16 }, tokens, { fontSize: 16, minimumFont: 15, bold: true, color: tokens.colors.accentText, align: "center", valign: "mid" });
  });
  let rowY = box.y + headerH;
  block.criteria.forEach((criterion, row) => {
    const y = rowY;
    const labelBox = { x: tokens.rtl ? box.x + box.w - labelW : box.x, y, w: labelW, h: rowH };
    addEducationalPanel(pptx, slide, labelBox, tokens, { fill: tokens.colors.surfaceAlt, border: true });
    addEducationalText(slide, criterion, { x: labelBox.x + 0.12, y: y + 0.1, w: labelBox.w - 0.24, h: rowH - 0.2 }, tokens, { fontSize: 15, minimumFont: 15, bold: true, valign: "mid" });
    block.items.forEach((item, col) => {
      const visualCol = tokens.rtl ? block.items.length - col - 1 : col;
      const region = { x: tokens.rtl ? box.x + visualCol * itemW : box.x + labelW + col * itemW, y, w: itemW, h: rowH };
      addEducationalPanel(pptx, slide, region, tokens, { fill: row % 2 === 0 ? tokens.colors.background : tokens.colors.surfaceAlt, border: true });
      addEducationalText(slide, item.values[row] ?? "", { x: region.x + 0.12, y: y + 0.1, w: region.w - 0.24, h: rowH - 0.2 }, tokens, { fontSize: 15, minimumFont: 15, valign: "mid" });
    });
    rowY += rowH;
  });
}

function renderObjectiveChecklist(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const rows = educationalRows(spec.contentBlocks);
  const bodyY = addTopTakeaway(pptx, slide, spec.centralTakeaway, tokens);
  // Few targets get large type and generous spacing; the block is centered in the body area.
  addEducationalRows(pptx, slide, rows, { x: 1.0, y: bodyY + 0.1, w: 11.5, h: BODY_BOTTOM - bodyY - 0.1 }, tokens, {
    fonts: [26, 24, 22, 20, 18], checklist: true, gap: 0.22, spread: { maxGap: 0.55, center: !spec.centralTakeaway }, rules: true,
  });
}

function renderActivityBrief(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  image: ImageAsset | null,
  tpl: TemplateConfig,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const tasks = spec.contentBlocks.filter((block): block is Extract<EducationalContentBlock, { type: "task" }> => block.type === "task");
  const instructions = tasks.flatMap((block) => block.instructions);
  const orderedSteps = spec.contentBlocks.flatMap((block) => block.type === "orderedSteps" ? block.items : []);
  const actionSteps = [...orderedSteps, ...instructions];
  const materials = tasks.flatMap((block) => block.materials ?? []);
  const minutes = tasks.reduce((total, block) => total + (block.timeMinutes ?? 0), 0);
  const useImage = Boolean(image && spec.image && spec.layoutIntent.image !== "avoid");
  const supportingRows = educationalRows(spec.contentBlocks.filter((block) => block.type !== "task" && block.type !== "orderedSteps"));
  const leadRows = [
    ...(spec.centralTakeaway ? [{ text: spec.centralTakeaway, kind: "idea" as const }] : []),
    ...(actionSteps.length > 0 ? supportingRows : []),
  ];
  const bodyY = leadRows.length ? addLeadRows(pptx, slide, leadRows, tokens) : BODY_TOP;
  const bodyH = BODY_BOTTOM - bodyY;
  const hasSide = minutes > 0 || materials.length > 0 || useImage;
  const sideW = 3.7;
  const mainW = hasSide ? 11.7 - sideW - 0.55 : 11.7;
  const main = mirrorRegion({ x: 0.82, y: bodyY, w: mainW, h: bodyH }, tokens.rtl);
  const steps = actionSteps.length
    ? actionSteps.map((text) => ({ text, kind: "step" as const }))
    : educationalRows(spec.contentBlocks);
  addEducationalRows(pptx, slide, steps, main, tokens, { fonts: [22, 20, 18, 16], numbered: true, gap: 0.2, spread: { maxGap: 0.5 } });
  if (!hasSide) return;

  // Side column: time as a figure, materials as a short list, optional image last. A hairline separates it.
  const side = mirrorRegion({ x: 12.52 - sideW, y: bodyY, w: sideW, h: bodyH }, tokens.rtl);
  const ruleX = tokens.rtl ? side.x + side.w + 0.27 : side.x - 0.27;
  slide.addShape(pptx.ShapeType.line, { x: ruleX, y: bodyY, w: 0, h: bodyH, line: { color: tokens.colors.rule, pt: 0.75 } });
  let y = bodyY;
  if (minutes > 0) {
    if (y + 0.9 > BODY_BOTTOM) throw new Error("Activity timing does not fit in the remaining logistics column.");
    const unit = tokens.rtl ? "دقيقة" : "min";
    slide.addText([
      { text: String(minutes), options: { fontSize: 48, bold: true, color: tokens.colors.accent } },
      { text: ` ${unit}`, options: { fontSize: 20, color: tokens.colors.mutedText } },
    ], {
      x: side.x, y, w: side.w, h: 0.9, margin: 0, fontFace: tokens.fontFace, valign: "middle",
      align: tokens.rtl ? "right" : "left", ...directionOptions(tokens.rtl),
    });
    y += 1.0;
  }
  if (materials.length > 0) {
    const label = tokens.rtl ? "المواد المطلوبة" : "Materials";
    addEducationalText(slide, label, { x: side.x, y, w: side.w, h: 0.34 }, tokens, { fontSize: 15, minimumFont: 15, bold: true, color: tokens.colors.accent, valign: "mid" });
    y += 0.4;
    const listH = materials.reduce((sum, text) => sum + Math.max(0.34, estimateTextHeight(text, side.w - 0.4, 16)), 0) + 0.08 * (materials.length - 1);
    if (y + listH > BODY_BOTTOM) throw new Error(`Activity materials need ${listH.toFixed(2)} in, beyond the remaining ${Math.max(0, BODY_BOTTOM - y).toFixed(2)} in of the logistics column.`);
    addEducationalRows(pptx, slide, materials.map((text) => ({ text, kind: "step" as const })), { x: side.x, y, w: side.w, h: listH }, tokens, { fontSize: 16, gap: 0.08 });
    y += listH + 0.25;
  }
  if (useImage && image) {
    const imageH = BODY_BOTTOM - y;
    if (imageH >= 1.5) addEducationalImage(pptx, slide, image, { x: side.x, y, w: side.w, h: imageH }, tpl, spec.image?.altText ?? "Activity illustration");
    else if (spec.layoutIntent.image === "required") throw new Error(`The required activity image has only ${imageH.toFixed(2)} in of vertical space remaining.`);
    else console.warn(`[pptx educational render] slide ${spec.id}: optional image skipped, only ${imageH.toFixed(2)} in left beside the activity.`);
  }
}

function renderHingeQuestion(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const questions = spec.contentBlocks.filter((block): block is Extract<EducationalContentBlock, { type: "question" }> => block.type === "question");
  if (questions.length > 1) throw new Error(`Slide "${spec.title}" needs one hinge question per physical slide.`);
  const question = questions[0];
  const y = addTopTakeaway(pptx, slide, spec.centralTakeaway, tokens);
  const h = BODY_BOTTOM - y;
  const left = mirrorRegion({ x: 0.82, y, w: 5.05, h }, tokens.rtl);
  const right = mirrorRegion({ x: 6.32, y, w: 6.16, h }, tokens.rtl);
  const allRows = educationalRows(spec.contentBlocks);
  const prompt = question?.prompt ?? allRows[0]?.text ?? "";
  addTakeaway(pptx, slide, prompt, { x: left.x, y: left.y + 0.15, w: left.w, h: 2.75 }, tokens);
  const extraRows = educationalRows(spec.contentBlocks.filter((block) => block.type !== "question"));
  const options = question
    ? [...(question.options?.map((option) => option.text) ?? []), ...extraRows.map((row) => row.text)]
    : allRows.slice(1).map((row) => row.text);
  if (options.length > 0) addEducationalRows(pptx, slide, options.map((text) => ({ text })), right, tokens, { fontSize: 18, numbered: true, gap: 0.22 });
  else {
    const responseLabel = tokens.rtl ? "فكّر ثم اشرح إجابتك" : "Think, then explain your answer";
    addEducationalText(slide, responseLabel, { x: right.x + 0.2, y: right.y + 0.25, w: right.w - 0.4, h: 0.5 }, tokens, { fontSize: 16, bold: true, color: tokens.colors.mutedText });
    [1, 2, 3].forEach((index) => slide.addShape(pptx.ShapeType.line, { x: right.x + 0.2, y: right.y + 1.25 * index, w: right.w - 0.4, h: 0, line: { color: tokens.colors.rule, pt: 1 } }));
  }
}

function renderRetrievalPractice(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const rows = educationalRows(spec.contentBlocks);
  const bodyY = addTopTakeaway(pptx, slide, spec.centralTakeaway, tokens);
  // Each cue is a band: large numeral, big prompt, and open space beneath for the learner's answer.
  addEducationalRows(pptx, slide, rows, { x: 0.96, y: bodyY + 0.1, w: 11.5, h: BODY_BOTTOM - bodyY - 0.1 }, tokens, {
    fonts: [28, 26, 24, 22, 20, 18], numbered: true, gap: 0.3, spread: { maxGap: 0.9, center: !spec.centralTakeaway }, rules: true,
  });
}

function renderReflection(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  const reflections = spec.contentBlocks.filter((block): block is Extract<EducationalContentBlock, { type: "reflection" }> => block.type === "reflection");
  const prompts = reflections.flatMap((reflection) => reflection.prompts);
  const starters = reflections.flatMap((reflection) => reflection.sentenceStarters ?? []);
  const extraRows = educationalRows(spec.contentBlocks.filter((block) => block.type !== "reflection"));
  const bodyY = addTopTakeaway(pptx, slide, spec.centralTakeaway, tokens);
  const prompt = prompts[0] ?? extraRows[0]?.text ?? spec.centralTakeaway ?? "";
  const focus = mirrorRegion({ x: 1.18, y: bodyY + (spec.centralTakeaway ? 0 : 0.1), w: 10.98, h: Math.max(1.3, 3.86 - bodyY) }, tokens.rtl);
  addEducationalText(slide, prompt, focus, tokens, { fontSize: 27, minimumFont: 20, bold: true, align: "center", valign: "mid" });
  const supporting = [
    ...prompts.slice(1),
    ...starters,
    ...(prompts.length ? extraRows.map((row) => row.text) : extraRows.slice(1).map((row) => row.text)),
  ];
  if (supporting.length) {
    const stems = mirrorRegion({ x: 1.52, y: 4.32, w: 10.3, h: 1.55 }, tokens.rtl);
    addEducationalRows(pptx, slide, supporting.map((text) => ({ text })), stems, tokens, { fontSize: 17, numbered: false, gap: 0.12 });
  }
}

function renderEducationalComposition(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  spec: SlideSpec,
  image: ImageAsset | null,
  tpl: TemplateConfig,
  tokens: ReturnType<typeof getPptDesignTokens>,
): void {
  spec = omitDuplicatedCentralTakeaway(spec);
  const id = spec.composition as EducationalCompositionId;
  switch (id) {
    case "concept-focus": renderConceptFocus(pptx, slide, spec, image, tpl, tokens); return;
    case "definition-and-example": renderDefinitionExample(pptx, slide, spec, tokens); return;
    case "worked-example-steps": renderWorkedExample(pptx, slide, spec, tokens); return;
    case "labeled-diagram": renderLabeledDiagram(pptx, slide, spec, tokens); return;
    case "process-flow": renderProcessFlow(pptx, slide, spec, tokens); return;
    case "comparison-matrix": {
      const comparisons = spec.contentBlocks.filter((block): block is Extract<EducationalContentBlock, { type: "comparison" }> => block.type === "comparison");
      if (comparisons.length > 0) {
        const otherRows = educationalRows(spec.contentBlocks.filter((block) => block.type !== "comparison"));
        const topRows = [
          ...(spec.centralTakeaway ? [{ text: spec.centralTakeaway, kind: "idea" as const }] : []),
          ...otherRows,
        ];
        const bodyY = topRows.length ? addLeadRows(pptx, slide, topRows, tokens) : 1.6;
        const base = comparisons[0]!;
        const sameItems = comparisons.every((comparison) => comparison.items.map((item) => item.label).join("|") === base.items.map((item) => item.label).join("|"));
        if (!sameItems) throw new Error(`Slide "${spec.title}" has multiple comparison blocks with different item sets that cannot share one matrix.`);
        const combined: Extract<EducationalContentBlock, { type: "comparison" }> = {
          type: "comparison",
          criteria: comparisons.flatMap((comparison) => comparison.criteria),
          items: base.items.map((item, index) => ({ label: item.label, values: comparisons.flatMap((comparison) => comparison.items[index]?.values ?? []) })),
        };
        renderComparison(pptx, slide, combined, tokens, { x: 0.76, y: bodyY, w: 11.8, h: BODY_BOTTOM + 0.04 - bodyY });
      }
      else addEducationalRows(pptx, slide, educationalRows(spec.contentBlocks), { x: 0.82, y: 1.72, w: 11.7, h: 4.9 }, tokens, { fontSize: 17, numbered: true });
      return;
    }
    case "objective-checklist": renderObjectiveChecklist(pptx, slide, spec, tokens); return;
    case "activity-brief": renderActivityBrief(pptx, slide, spec, image, tpl, tokens); return;
    case "hinge-question": renderHingeQuestion(pptx, slide, spec, tokens); return;
    case "retrieval-practice": renderRetrievalPractice(pptx, slide, spec, tokens); return;
    case "reflection-prompt": renderReflection(pptx, slide, spec, tokens); return;
    case "summary-map": renderSummaryMap(pptx, slide, spec, tokens); return;
  }
}

function formatDeckNotes(spec: SlideSpec): string {
  const answerNotes = spec.contentBlocks.flatMap((block) => {
    if (block.type !== "question" || !block.correctOptionIds?.length) return [];
    const correct = new Set(block.correctOptionIds);
    return block.options?.filter((option) => correct.has(option.id)).map((option) => option.text) ?? [];
  });
  const assessmentAnswer = answerNotes.length ? `\n\nTeacher answer key: ${answerNotes.join("; ")}` : "";
  const aflNotes = spec.afl
    ? (() => {
        const phase = AFL_PHASE_GROUPS.find((group) => group.phase === spec.afl!.phase);
        const labels = spec.afl!.selectedToolIds
          .map((id) => phase?.tools.find((tool) => tool.id === id)?.label)
          .filter((label): label is string => Boolean(label));
        const callout = spec.afl!.callout ? `; ${spec.afl!.callout}` : "";
        return labels.length ? `\n\nAssessment for learning (${phase?.title ?? spec.afl!.phase}): ${labels.join(", ")}${callout}` : "";
      })()
    : "";
  return `${spec.speakerNotes}${assessmentAnswer}${aflNotes}`.trim();
}

/** Schema-native, composition-driven export. All visible content is native editable PPT text/shapes. */
// A 1x1 stand-in so fit trials lay out the with-image variant of a composition without fetching anything.
const FIT_TRIAL_IMAGE: ImageAsset = {
  dataUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  width: 800,
  height: 600,
};

/**
 * Renders a candidate page into a throwaway deck to learn whether its content fits at the minimum
 * font sizes. Tries the slide's own composition first, then registry fallbacks that support every
 * block on the page; returns the composition that holds it, or null so the caller can split.
 */
function isSimpleOpeningCover(spec: SlideSpec): boolean {
  return spec.pedagogicalPurpose === "opening" && spec.contentBlocks.every((block) =>
    block.type === "paragraph" || block.type === "keyIdea" || block.type === "bulletList",
  );
}

function createFitChecker(tpl: TemplateConfig, tokens: ReturnType<typeof getPptDesignTokens>, deck: DeckSpec): {
  fit: (page: SlideSpec, hasImage: boolean) => EducationalCompositionId | null;
  lastError: () => string;
} {
  let lastMessage = "unknown fit failure";
  const fit = (page: SlideSpec, hasImage: boolean): EducationalCompositionId | null => {
    const own = page.composition as EducationalCompositionId;
    const openingCover = page.id === deck.slides[0]?.id && isSimpleOpeningCover(page);
    if (openingCover) {
      const trial = new PptxGenJS();
      trial.layout = "LAYOUT_WIDE";
      try {
        renderOpeningComposition(trial, trial.addSlide(), page, deck,
          hasImage && page.layoutIntent.image !== "avoid" ? FIT_TRIAL_IMAGE : null, tpl, tokens);
        return own;
      } catch (error) {
        lastMessage = error instanceof Error ? error.message : String(error);
        return null;
      }
    }
    const definition = getCompositionDefinition(own);
    const candidates = [own, ...definition.fallbacks.filter((id) => {
      const supported: readonly string[] = getCompositionDefinition(id).supportedBlocks;
      return page.contentBlocks.every((block) => supported.includes(block.type));
    })];
    for (const candidate of candidates) {
      const trial = new PptxGenJS();
      trial.layout = "LAYOUT_WIDE";
      try {
        renderEducationalComposition(trial, trial.addSlide(), { ...page, composition: candidate }, hasImage && page.layoutIntent.image !== "avoid" ? FIT_TRIAL_IMAGE : null, tpl, tokens);
        return candidate;
      } catch (error) {
        lastMessage = error instanceof Error ? error.message : String(error);
      }
    }
    return null;
  };
  return { fit, lastError: () => lastMessage };
}

export class PptContentError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "PptContentError";
  }
}

export async function buildPptxFromDeckSpec(params: {
  deck: DeckSpec;
  templateId?: TemplateId | string;
  schoolLogo?: string | null;
  slideImageUrls?: (string | null)[] | null;
}): Promise<Buffer> {
  const inputValidation = parseDeckSpec(params.deck);
  if (!inputValidation.ok) {
    throw new PptContentError("INVALID_EDUCATIONAL_DECK", `Cannot render educational slide deck: ${inputValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  if ((params.slideImageUrls?.length ?? 0) > MAX_DECK_SLIDES) {
    throw new PptContentError("INVALID_EDUCATIONAL_DECK", `A deck can contain at most ${MAX_DECK_SLIDES} slide image URLs.`);
  }
  const candidateDeck: DeckSpec = {
    ...inputValidation.value,
    slides: inputValidation.value.slides.map((slide, index) => {
      const url = slide.image?.url ?? params.slideImageUrls?.[index] ?? null;
      return url && !slide.image ? { ...slide, image: { url, fit: "contain" as const } } : slide;
    }),
  };
  const selected = selectDeckCompositions(candidateDeck);
  if (!selected.ok) {
    throw new PptContentError("INVALID_EDUCATIONAL_DECK", `Cannot render educational slide deck: ${selected.issues.map((issue) => `${issue.slideId}: ${issue.message}`).join("; ")}`);
  }
  const deck = selected.deck;
  const tpl = getTemplateConfig(params.templateId ?? deck.theme.id);
  const language = deck.language;
  const ctx = buildRenderContext(language, tpl);
  const tokens = getPptDesignTokens(tpl, language);
  const preparedPages: { spec: SlideSpec; sourceIndex: number; isContinuation: boolean }[] = [];
  const fitChecker = createFitChecker(tpl, tokens, deck);
  for (const [sourceIndex, spec] of deck.slides.entries()) {
    const remainingPages = MAX_PHYSICAL_SLIDES - preparedPages.length;
    const pagination = paginateToFit(spec, deck.textDirection === "rtl", fitChecker.fit, fitChecker.lastError, remainingPages);
    if (!pagination.ok) {
      const code = pagination.code === "maximum_slide_count_exceeded" ? "MAXIMUM_SLIDE_COUNT_EXCEEDED" : "SLIDE_CONTENT_DOES_NOT_FIT";
      throw new PptContentError(code, `Cannot fit slide "${spec.title}": ${pagination.message}`);
    }
    for (const page of pagination.slides) {
      preparedPages.push({
        spec: { ...page, order: preparedPages.length },
        sourceIndex,
        isContinuation: page.id !== spec.id,
      });
    }
  }
  const imageBySlide = await Promise.all(preparedPages.map(async ({ spec, sourceIndex, isContinuation }) => {
    if (isContinuation || spec.layoutIntent.image === "avoid") return null;
    const url = spec.image?.url ?? params.slideImageUrls?.[sourceIndex] ?? null;
    if (!url) return null;
    try { return await fetchImageAsset(url); }
    catch (error) {
      console.error(`[pptx educational render] slide ${spec.id}: image unavailable: ${error instanceof Error ? error.message : String(error)}`);
      if (spec.layoutIntent.image === "required") {
        throw new PptContentError("REQUIRED_IMAGE_UNAVAILABLE", `The required image for slide "${spec.title}" could not be downloaded. Check the image URL or choose an optional image.`);
      }
      return null;
    }
  }));
  const layahLogo = await loadLayahLogo();
  const schoolLogo = params.schoolLogo ?? null;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.rtlMode = ctx.rtl;
  pptx.author = "Layah.ai";
  pptx.company = "Layah.ai";
  pptx.subject = `${deck.subject} — ${deck.topic ?? "lesson"}`;
  pptx.title = `${ctx.s("deckTitlePrefix")} — ${deck.topic ?? deck.subject}`;
  const safetyModels: StructuredLessonSlideModel[] = deck.slides.map((spec) => ({
    slideTitle: spec.title,
    body: spec.contentBlocks.flatMap(blockText).join("\n"),
    speakerNotes: spec.speakerNotes,
    includeImageSlot: Boolean(spec.image?.url),
  }));
  const warnings = validatePptContentSafety(safetyModels);
  if (warnings.length) console.warn("[pptx educational render] content safety warnings:", JSON.stringify(warnings.map((warning) => ({ slide: warning.slideNumber1Based, kind: warning.kind, message: warning.message }))));
  const total = preparedPages.length;
  preparedPages.forEach(({ spec, isContinuation }, index) => {
    const slide = pptx.addSlide();
    const image = imageBySlide[index] ?? null;
    if (index === 0 && !isContinuation && isSimpleOpeningCover(spec)) {
      slide.background = { color: tokens.colors.background };
      renderOpeningComposition(pptx, slide, spec, deck, image, tpl, tokens);
      addFooter(pptx, slide, tpl, tokens.fontFace, deck.subject, index + 1, total, layahLogo);
      if (schoolLogo) addSchoolLogo(pptx, slide, schoolLogo);
    } else {
      addEducationalHeader(pptx, slide, spec, tpl, tokens, deck.subject, index + 1, total, layahLogo, schoolLogo);
      renderEducationalComposition(pptx, slide, spec, image, tpl, tokens);
    }
    const notes = formatDeckNotes(spec);
    slide.addNotes(isContinuation ? `${notes}\n\n${ctx.s("continuationNote")}` : notes);
  });
  return repairPptxPackage((await pptx.write({ outputType: "nodebuffer" })) as Buffer);
}
