/**
 * Shared pptxgenjs drawing primitives for the Layah PPT template engine.
 *
 * Pure rendering helpers — no content logic, no theme selection. Every helper takes an already
 * resolved `TemplateConfig` (colors/fonts/design tokens) and draws onto a given slide.
 */
import PptxGenJS from "pptxgenjs";
import type { TemplateConfig } from "@/lib/ppt-template-config";

// ─── Natural image size (for undistorted placement) ───────────────────────────────────────────
//
// pptxgenjs ships a `sizing: {type: "cover"}` option, but in the installed version its natural-
// image-dimension lookup is dead code (commented out upstream), so it silently no-ops and just
// stretches the source image to fill the box — the exact distortion we're trying to avoid. We
// read real width/height ourselves (PNG/JPEG/WEBP headers only, no decoding) and size the image
// to fit its frame without distortion instead of depending on that library feature.

export function getImageNaturalSize(buf: Buffer): { width: number; height: number } | null {
  try {
    // PNG: 8-byte signature, then IHDR chunk with width/height as big-endian uint32 at offset 16/20.
    if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    // JPEG: scan markers for a start-of-frame segment carrying height/width.
    if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1]!;
        if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
        if (marker >= 0xd0 && marker <= 0xd7) { i += 2; continue; }
        const segLen = buf.readUInt16BE(i + 2);
        const isSOF =
          (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
        if (isSOF) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + segLen;
      }
      return null;
    }
    // WEBP (VP8X extended header carries canvas size; VP8 lossy carries frame size).
    if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
      const chunk = buf.toString("ascii", 12, 16);
      if (chunk === "VP8X") {
        return { width: (buf.readUIntLE(24, 3) + 1), height: (buf.readUIntLE(27, 3) + 1) };
      }
      if (chunk === "VP8 ") {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Row-height heuristics (kept in sync with chunking budget in ppt-template-engine.ts) ─────

/** Height (inches) reserved per wrapped text line inside a bullet/checklist row. */
export const ROW_LINE_H = 0.3;
/** Vertical gap (inches) between consecutive bullet/checklist rows. */
export const ROW_GAP = 0.14;
/** Minimum row height (inches) — keeps the marker visually centered even for very short lines. */
export const ROW_MIN_H = 0.34;
/** Extra breathing room ABOVE a standalone group-header row (see isGroupHeaderLine) — separates
 *  one sub-section's instructions from the next instead of the two running together. */
export const HEADER_TOP_GAP = 0.12;

export function wrappedLineCount(text: string, cpl: number): number {
  return Math.max(1, Math.ceil(text.length / Math.max(1, cpl)));
}

/**
 * `scale` grows both the effective row height and shrinks the effective chars-per-line — used to
 * keep height estimates consistent with `drawBulletBlock` rendering the same lines at a larger
 * font on sparse slides (see `fontScale` in ppt-template-engine.ts).
 *
 * `variant`, when `"activity"`, folds in `HEADER_TOP_GAP` for a group-header line so the chunker
 * (chunkLinesByHeight in ppt-template-engine.ts, which calls this per line) budgets the same extra
 * space `drawBulletBlock` actually draws — without that, a slide with several differentiated-task
 * groups under-reserves height for their header rows and the last group gets clipped at the bottom
 * of the content area instead of flowing onto a continuation slide. Scoped to `"activity"` rather
 * than every variant: checklist content (Learning Objectives, Success Criteria) is often written
 * as short phrases with no terminal punctuation, which would otherwise false-positive as headers
 * and lose their checkbox marker — the standalone-label shape this exists for is specific to
 * activity slides (differentiated tasks, warm-ups, plenaries).
 */
export function estimateRowHeight(text: string, cpl: number, scale = 1, variant?: BulletVariant): number {
  const effectiveCpl = Math.max(8, Math.round(cpl / scale));
  const base =
    Math.max(ROW_MIN_H * scale, wrappedLineCount(text, effectiveCpl) * ROW_LINE_H * scale) + ROW_GAP * scale;
  return variant === "activity" && isGroupHeaderLine(text) ? base + HEADER_TOP_GAP * scale : base;
}

/** Total height `drawBulletBlock` will consume for `lines` — lets callers center short blocks. */
export function estimateBlockHeight(lines: string[], cpl: number, scale = 1, variant?: BulletVariant): number {
  return lines.reduce((sum, line) => sum + estimateRowHeight(line, cpl, scale, variant), 0);
}

// ─── Lead-in label detection ("Higher Achievers: a challenging task…") ──────────────────────

const LEAD_IN_RE = /^([A-Z][A-Za-z0-9 /&'()]{1,42})\s*[:—–-]\s+(.+)$/;

export function splitLeadIn(line: string): { label: string | null; rest: string } {
  const m = LEAD_IN_RE.exec(line.trim());
  if (!m) return { label: null, rest: line };
  const [, label, rest] = m;
  if (!rest || rest.trim().length < 3) return { label: null, rest: line };
  return { label: label!.trim(), rest: rest.trim() };
}

// ─── Group-header detection ("Higher Achievers task", "Middle Achievers task"…) ────────────────
//
// The generated content sometimes emits a short STANDALONE label line, followed by several
// separate instruction bullets under it — a differentiated-task grouping being the clearest
// example: "Higher Achievers task" / "Middle Achievers task" / "Lower Achievers task", each
// followed by its own 3-4 sub-bullets. That shape is structurally different from what
// `splitLeadIn` handles (one label + its own instruction, same line) and previously fell through
// to the plain-bullet branch — rendered with the same marker, size and colour as every
// instruction under it, so a teacher scanning the slide had no visual cue where one group's
// tasks ended and the next began.
//
// Real instructions in this content overwhelmingly end in sentence punctuation (a period,
// mid-sentence comma+continuation, etc.); a short capitalised line with none is reliably a label,
// not an instruction — verified against the actual generated deck this was written to fix.
export function isGroupHeaderLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 46) return false;
  if (/[.!?:;,]$/.test(t)) return false; // real instructions end with sentence punctuation
  if (splitLeadIn(t).label !== null) return false; // an inline "Label: text" line, not a header
  if (!/^[A-Z]/.test(t)) return false; // headers start capitalised
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 6;
}

// ─── Icon badge ───────────────────────────────────────────────────────────────────────────────

export function drawIconBadge(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  opts: { icon: string; x: number; y: number; size: number; tpl: TemplateConfig; onDark?: boolean },
): void {
  const { icon, x, y, size, tpl, onDark } = opts;
  const d = tpl.design;
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w: size, h: size,
    rectRadius: size * 0.32,
    fill: { color: onDark ? "FFFFFF" : d.chipFill, transparency: onDark ? 85 : 0 },
    line: { color: onDark ? "FFFFFF" : d.cardBorder, transparency: onDark ? 60 : 0, pt: 0.75 },
  });
  slide.addText(icon, {
    x, y, w: size, h: size,
    fontSize: size * 34, align: "center", valign: "middle",
  });
}

// ─── Section chip / pill label ─────────────────────────────────────────────────────────────────

export function drawSectionChip(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  opts: { text: string; x: number; y: number; tpl: TemplateConfig },
): { w: number; h: number } {
  const { text, x, y, tpl } = opts;
  const d = tpl.design;
  const h = 0.28;
  // Bold uppercase glyphs at this size run wider than the old 0.078"/char
  // estimate (tuned for mixed-case body text), which under-sized this box for
  // anything past a couple of words — "Differentiated Tasks" and the title
  // slide's "Subject · Grade" chip both wrapped onto a second line inside a
  // box only tall enough for one, so the wrapped line bled out of the pill
  // and into whatever sat above it (the icon badge, on the title slide).
  const w = Math.min(5.6, Math.max(1.1, text.length * 0.105 + 0.4));
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: h / 2,
    fill: { color: d.chipFill },
    line: { color: d.chipFill },
  });
  slide.addText(text.toUpperCase(), {
    x, y, w, h,
    fontSize: d.typography.sectionLabel, bold: true, color: d.chipText,
    fontFace: tpl.fonts.face, align: "center", valign: "middle", charSpacing: 1,
    // A pill is a single-line label by definition. `fit: "shrink"` alone
    // isn't enough — pptxgenjs wraps by default *before* it considers
    // shrinking, which is what caused the two-line overflow above.
    // `wrap: false` forces the one-line-or-shrink behaviour this needs,
    // regardless of how good the width estimate above turns out to be.
    wrap: false, fit: "shrink",
  });
  return { w, h };
}

// ─── Card frame (rounded background panel with soft shadow) ────────────────────────────────────

export function drawCardFrame(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  opts: { x: number; y: number; w: number; h: number; tpl: TemplateConfig; fill?: string; border?: string; shadow?: boolean },
): void {
  const { x, y, w, h, tpl, fill, border, shadow = true } = opts;
  const d = tpl.design;
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: d.radius.card,
    fill: { color: fill ?? d.cardFill },
    line: { color: border ?? d.cardBorder, pt: 1 },
    ...(shadow
      ? { shadow: { type: "outer", color: d.shadow.color, opacity: d.shadow.opacity, blur: d.shadow.blur, offset: d.shadow.offset, angle: 90 } }
      : {}),
  });
}

// ─── Rounded image frame (card + shadow behind an inset image) ─────────────────────────────────

export function drawRoundedImageFrame(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  opts: {
    x: number; y: number; w: number; h: number; imageDataUri: string; tpl: TemplateConfig;
    altText?: string; naturalWidth?: number; naturalHeight?: number;
  },
): void {
  const { x, y, w, h, imageDataUri, tpl, altText, naturalWidth, naturalHeight } = opts;
  const d = tpl.design;
  const pad = 0.1;
  const boxW = w - pad * 2;
  const boxH = h - pad * 2;
  drawCardFrame(pptx, slide, { x, y, w, h, tpl });

  // Fit the image inside its frame at its own aspect ratio instead of stretching it to fill —
  // pptxgenjs's built-in `sizing: {type:"cover"}` can't do this (its natural-size lookup is dead
  // code in the installed version), so we size/center it ourselves from the real pixel dimensions.
  let drawW = boxW, drawH = boxH, drawX = x + pad, drawY = y + pad;
  if (naturalWidth && naturalHeight) {
    const scale = Math.min(boxW / naturalWidth, boxH / naturalHeight);
    drawW = naturalWidth * scale;
    drawH = naturalHeight * scale;
    drawX = x + pad + (boxW - drawW) / 2;
    drawY = y + pad + (boxH - drawH) / 2;
  }

  slide.addImage({
    data: imageDataUri,
    x: drawX, y: drawY, w: drawW, h: drawH,
    altText: altText ?? "Slide illustration",
    shadow: { type: "outer", color: d.shadow.color, opacity: d.shadow.opacity * 0.7, blur: d.shadow.blur * 0.6, offset: 2, angle: 90 },
  });
}

// ─── Bullet / checklist / activity row block ────────────────────────────────────────────────────

export type BulletVariant = "bullet" | "checklist" | "activity";

/**
 * Draws `lines` as a vertical stack of marker + text rows starting at (x, y), each row width `w`.
 * Returns the total vertical space consumed (inches) — callers pre-budget via
 * `estimateRowHeight`/chunking so this should never exceed the box height it was given.
 *
 * `scale` (default 1) grows font size, marker size, and row height together — used by the caller
 * to make sparsely-filled slides read as intentional rather than empty, instead of leaving body
 * text sitting small in a mostly-blank box. Must match the `scale` passed to
 * `estimateRowHeight`/`estimateBlockHeight` when the caller pre-computed this block's height.
 */
export function drawBulletBlock(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  opts: { x: number; y: number; w: number; lines: string[]; tpl: TemplateConfig; variant: BulletVariant; cpl: number; scale?: number },
): number {
  const { x, y, w, lines, tpl, variant, cpl, scale = 1 } = opts;
  const d = tpl.design;
  const c = tpl.colors;
  const f = tpl.fonts;
  const markerSize = 0.2 * scale;
  const rowPad = variant === "checklist" ? 0.12 : 0;
  const markerX = x + rowPad;
  const textX = markerX + markerSize + 0.16;
  const textW = x + w - rowPad - (textX - x);
  const bodyFontSize = f.contentSize * scale;

  let curY = y;
  for (const raw of lines) {
    const rowH = estimateRowHeight(raw, cpl, scale, variant);

    // Standalone sub-section label ("Higher Achievers task") rather than an instruction —
    // see isGroupHeaderLine. Rendered as a heading: no bullet marker (it isn't a list item),
    // bold + the theme's accent colour (the same role colour section chips already use, so a
    // teacher reads "accent-coloured text" as "this is a label" consistently across the slide),
    // one size up from body text, with a short accent rule underneath in place of a marker glyph.
    // The gap this reserves above itself was already folded into `rowH` by estimateRowHeight, so
    // it never has to compete with the previous group's last line for space.
    //
    // Scoped to `variant === "activity"` — see estimateRowHeight's doc comment for why checklist/
    // plain-bullet content is excluded.
    if (variant === "activity" && isGroupHeaderLine(raw)) {
      const gap = HEADER_TOP_GAP * scale;
      const headerY = curY + gap;
      slide.addText(raw, {
        x: textX, y: headerY, w: textW, h: rowH - gap,
        fontSize: bodyFontSize + 1, bold: true, color: c.accent, fontFace: f.face,
        valign: "top", lineSpacingMultiple: 1.1, fit: "shrink",
      });
      slide.addShape(pptx.ShapeType.line, {
        x: textX, y: headerY + ROW_LINE_H * scale - 0.03, w: Math.min(1.3, textW * 0.35), h: 0,
        line: { color: c.accent, pt: 0.75 },
      });
      curY += rowH;
      continue;
    }

    const markerY = curY + Math.max(0, (ROW_MIN_H * scale - markerSize) / 2);

    if (variant === "checklist") {
      slide.addShape(pptx.ShapeType.roundRect, {
        x, y: curY, w, h: rowH - ROW_GAP * scale * 0.6,
        rectRadius: 0.06,
        fill: { color: d.cardFill }, line: { color: d.cardBorder, pt: 0.75 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: markerX, y: markerY, w: markerSize, h: markerSize,
        fill: { color: d.checklistTick }, line: { color: d.checklistTick },
      });
      slide.addText("✓", {
        x: markerX, y: markerY, w: markerSize, h: markerSize,
        fontSize: 10 * scale, bold: true, color: "FFFFFF", align: "center", valign: "middle",
      });
    } else if (variant === "activity") {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: markerX, y: markerY + markerSize * 0.15, w: markerSize * 0.7, h: markerSize * 0.7,
        rectRadius: 0.03,
        fill: { color: c.accent }, line: { color: c.accent },
      });
    } else {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: markerX + markerSize * 0.25, y: markerY + markerSize * 0.25, w: markerSize * 0.5, h: markerSize * 0.5,
        fill: { color: c.accent }, line: { color: c.accent },
      });
    }

    const { label, rest } = splitLeadIn(raw);
    if (label) {
      slide.addText(
        [
          {
            text: `${label.toUpperCase()}  `,
            options: {
              bold: true,
              color: c.accent,
              fontSize: bodyFontSize + 2,
              fontFace: f.face,
              charSpacing: 0.5,
            },
          },
          { text: rest, options: { color: c.contentText, fontSize: bodyFontSize, fontFace: f.face } },
        ],
        // fit:"shrink" is a safety net, not the primary sizing mechanism — chunkLinesByHeight
        // already budgets each row's height from estimateRowHeight, but an unusually long single
        // word/URL/number can still overflow the wrap estimate; shrink-to-fit catches that case
        // instead of clipping.
        { x: textX, y: curY, w: textW, h: rowH, valign: "top", lineSpacingMultiple: 1.18, fit: "shrink" },
      );
    } else {
      slide.addText(raw, {
        x: textX, y: curY, w: textW, h: rowH,
        fontSize: bodyFontSize, color: c.contentText, fontFace: f.face,
        valign: "top", lineSpacingMultiple: 1.18, fit: "shrink",
      });
    }

    curY += rowH;
  }
  return curY - y;
}

// ─── Footer progress pill ───────────────────────────────────────────────────────────────────────

export function drawProgressPill(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  opts: { x: number; y: number; w: number; h: number; ratio: number; tpl: TemplateConfig },
): void {
  const { x, y, w, h, ratio, tpl } = opts;
  const c = tpl.colors;
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: h / 2,
    fill: { color: c.progressTrack }, line: { color: c.progressTrack },
  });
  const fillW = Math.max(h, ratio * w);
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w: fillW, h, rectRadius: h / 2,
    fill: { color: c.progressFill }, line: { color: c.progressFill },
  });
}
