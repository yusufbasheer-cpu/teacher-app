import PptxGenJS from "pptxgenjs";
import {
  LAYAH_WIDESCREEN,
  resolveLearningObjectiveSlot,
  type LearningObjectiveContent,
  type LearningObjectiveLayoutDefinition,
  type LearningObjectiveRenderContext,
} from "@/lib/ppt-layouts/learning-objective-layout";

export const PROVISIONAL_LEARNING_OBJECTIVE_FLAG = "PPT_LEARNING_OBJECTIVE_LAYOUTS_ENABLED";
export type ProvisionalLearningObjectiveLayoutId = "lo_statement_01" | "lo_target_01";
export type LearningObjectiveLayoutChoice = "existing" | ProvisionalLearningObjectiveLayoutId;

const COLORS = {
  navy: "102A43",
  teal: "0F8B8D",
  mint: "BEE9E8",
  offWhite: "F7F5EF",
  white: "FFFFFF",
  muted: "526777",
} as const;

const HEADING_FONTS = ["Poppins", "Arial", "Calibri"] as const;
const BODY_FONTS = ["Poppins", "Arial", "Calibri"] as const;

function objectiveFontSize(length: number, sizes: readonly [number, number, number]): number {
  if (length <= 90) return sizes[0];
  if (length <= 180) return sizes[1];
  return sizes[2];
}

function addText(
  slide: PptxGenJS.Slide,
  text: string,
  box: { x: number; y: number; w: number; h: number },
  options: PptxGenJS.TextPropsOptions,
): void {
  slide.addText(text, { ...box, margin: 0, breakLine: false, fit: "shrink", valign: "middle", ...options });
}

function renderStatement(pptx: PptxGenJS, slide: PptxGenJS.Slide, content: LearningObjectiveContent, context: LearningObjectiveRenderContext): void {
  const label = resolveLearningObjectiveSlot(STATEMENT_LAYOUT.slots[0]!.box, context);
  const objective = resolveLearningObjectiveSlot(STATEMENT_LAYOUT.slots[1]!.box, context);
  slide.background = { color: COLORS.offWhite };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.13, line: { transparency: 100 }, fill: { color: COLORS.teal } });
  slide.addShape(pptx.ShapeType.line, { x: 0.92, y: 1.73, w: 1.08, h: 0, line: { color: COLORS.teal, pt: 3.2 } });
  addText(slide, (content.label || "LEARNING OBJECTIVE").toUpperCase(), label, {
    fontFace: HEADING_FONTS[0], fontSize: 15, bold: true, charSpacing: 2.1, color: COLORS.teal,
  });
  addText(slide, content.objective, objective, {
    fontFace: BODY_FONTS[0], fontSize: objectiveFontSize(content.objective.length, [42, 36, 30]), bold: true,
    color: COLORS.navy, breakLine: false, valign: "middle", paraSpaceAfter: 0,
  });
  // A single rising path gives the editorial composition a purposeful learning-goal motif.
  const path = [
    { x: 8.55, y: 6.18 }, { x: 9.42, y: 5.28 }, { x: 10.25, y: 5.52 }, { x: 11.52, y: 3.18 }, { x: 12.28, y: 3.18 },
  ];
  path.slice(0, -1).forEach((point, index) => {
    const next = path[index + 1]!;
    slide.addShape(pptx.ShapeType.line, {
      x: point.x, y: point.y, w: next.x - point.x, h: next.y - point.y,
      line: { color: index === path.length - 2 ? COLORS.teal : COLORS.navy, pt: 3, endArrowType: index === path.length - 2 ? "triangle" : undefined },
    });
  });
  path.slice(0, -1).forEach((point, index) => {
    const diameter = index === 3 ? 0.48 : 0.28;
    slide.addShape(pptx.ShapeType.ellipse, {
      x: point.x - diameter / 2, y: point.y - diameter / 2, w: diameter, h: diameter,
      line: { color: index === 3 ? COLORS.teal : COLORS.navy, pt: 2 },
      fill: { color: index === 3 ? COLORS.mint : COLORS.offWhite },
    });
  });
  slide.addShape(pptx.ShapeType.line, { x: 8.52, y: 6.78, w: 3.73, h: 0, line: { color: COLORS.mint, pt: 5 } });
}

function renderTarget(pptx: PptxGenJS, slide: PptxGenJS.Slide, content: LearningObjectiveContent, context: LearningObjectiveRenderContext): void {
  const label = resolveLearningObjectiveSlot(TARGET_LAYOUT.slots[0]!.box, context);
  const objective = resolveLearningObjectiveSlot(TARGET_LAYOUT.slots[1]!.box, context);
  slide.background = { color: COLORS.navy };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.14, h: 7.5, line: { transparency: 100 }, fill: { color: COLORS.mint } });
  slide.addShape(pptx.ShapeType.ellipse, { x: 8.46, y: 1.13, w: 4.35, h: 4.35, line: { transparency: 100 }, fill: { color: "173B58", transparency: 8 } });
  addText(slide, (content.label || "LEARNING OBJECTIVE").toUpperCase(), label, {
    fontFace: HEADING_FONTS[0], fontSize: 16, bold: true, charSpacing: 2, color: COLORS.mint,
  });
  addText(slide, content.objective, objective, {
    fontFace: BODY_FONTS[0], fontSize: objectiveFontSize(content.objective.length, [40, 35, 30]), bold: true,
    color: COLORS.offWhite, valign: "middle",
  });
  slide.addShape(pptx.ShapeType.line, { x: 0.92, y: 1.77, w: 1.22, h: 0, line: { color: COLORS.teal, pt: 3.2 } });
  const center = { x: 10.63, y: 3.31 };
  const rings = [3.16, 2.38, 1.58, 0.76];
  const fills = [COLORS.navy, COLORS.teal, COLORS.navy, COLORS.mint];
  rings.forEach((diameter, index) => {
    slide.addShape(pptx.ShapeType.ellipse, {
      x: center.x - diameter / 2, y: center.y - diameter / 2, w: diameter, h: diameter,
      line: { color: index % 2 === 0 ? COLORS.mint : COLORS.teal, pt: index === 0 ? 3 : 2 },
      fill: { color: fills[index]!, transparency: index === 0 || index === 2 ? 100 : 0 },
    });
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 7.62, y: 5.72, w: center.x - 7.62, h: center.y - 5.72,
    line: { color: COLORS.offWhite, pt: 3.2, endArrowType: "triangle" },
  });
  slide.addShape(pptx.ShapeType.line, { x: 0.92, y: 6.68, w: 6.3, h: 0, line: { color: COLORS.teal, transparency: 18, pt: 1.2 } });
}

export const STATEMENT_LAYOUT: LearningObjectiveLayoutDefinition = {
  id: "lo_statement_01",
  slideType: "learning-objective",
  aspectRatio: LAYAH_WIDESCREEN.aspectRatio,
  backgroundAsset: null,
  slots: [
    { name: "label", box: { x: 0.069, y: 0.178, width: 0.57, height: 0.06 }, required: false, maxCharacters: 32, maxLines: 1, minimumFontPoints: 15, fontFallbacks: HEADING_FONTS },
    { name: "objective", box: { x: 0.069, y: 0.275, width: 0.59, height: 0.49 }, required: true, maxCharacters: 280, maxLines: 6, minimumFontPoints: 28, fontFallbacks: BODY_FONTS },
  ],
  protectedRegions: [{ x: 0.66, y: 0.3, width: 0.3, height: 0.62 }],
  render: renderStatement,
};

export const TARGET_LAYOUT: LearningObjectiveLayoutDefinition = {
  id: "lo_target_01",
  slideType: "learning-objective",
  aspectRatio: LAYAH_WIDESCREEN.aspectRatio,
  backgroundAsset: null,
  slots: [
    { name: "label", box: { x: 0.069, y: 0.184, width: 0.48, height: 0.06 }, required: false, maxCharacters: 32, maxLines: 1, minimumFontPoints: 16, fontFallbacks: HEADING_FONTS },
    { name: "objective", box: { x: 0.069, y: 0.278, width: 0.51, height: 0.45 }, required: true, maxCharacters: 140, maxLines: 4, minimumFontPoints: 26, fontFallbacks: BODY_FONTS },
  ],
  protectedRegions: [{ x: 0.62, y: 0.14, width: 0.35, height: 0.75 }],
  render: renderTarget,
};

export const PROVISIONAL_LEARNING_OBJECTIVE_LAYOUTS = [STATEMENT_LAYOUT, TARGET_LAYOUT] as const;
