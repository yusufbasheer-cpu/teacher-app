import PptxGenJS from "pptxgenjs";
import {
  LAYAH_WIDESCREEN,
  learningObjectiveFits,
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
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.34, h: 7.5, line: { transparency: 100 }, fill: { color: COLORS.teal } });
  slide.addShape(pptx.ShapeType.rect, { x: 10.72, y: 0, w: 2.613, h: 7.5, line: { transparency: 100 }, fill: { color: COLORS.navy } });
  slide.addShape(pptx.ShapeType.line, { x: 0.92, y: 1.87, w: 0.82, h: 0, line: { color: COLORS.teal, pt: 4 } });
  addText(slide, (content.label || "LEARNING OBJECTIVE").toUpperCase(), label, {
    fontFace: HEADING_FONTS[0], fontSize: 14, bold: true, charSpacing: 2.2, color: COLORS.teal,
  });
  addText(slide, content.objective, objective, {
    fontFace: BODY_FONTS[0], fontSize: objectiveFontSize(content.objective.length, [39, 34, 29]), bold: true,
    color: COLORS.navy, breakLine: false, valign: "middle", paraSpaceAfter: 0,
  });
  addText(slide, "01", { x: 11.35, y: 0.72, w: 1.05, h: 0.55 }, {
    fontFace: HEADING_FONTS[0], fontSize: 16, bold: true, color: COLORS.mint, align: "center",
  });
  slide.addShape(pptx.ShapeType.line, { x: 11.3, y: 1.35, w: 1.15, h: 0, line: { color: COLORS.teal, pt: 1.5 } });
  addText(slide, "TODAY\nWE WILL", { x: 11.22, y: 5.36, w: 1.32, h: 0.9 }, {
    fontFace: HEADING_FONTS[0], fontSize: 12, bold: true, color: COLORS.white, align: "center", breakLine: true,
  });
  slide.addShape(pptx.ShapeType.ellipse, { x: 11.64, y: 6.46, w: 0.48, h: 0.48, line: { color: COLORS.mint, pt: 2 }, fill: { color: COLORS.navy, transparency: 100 } });
  slide.addShape(pptx.ShapeType.ellipse, { x: 11.78, y: 6.6, w: 0.2, h: 0.2, line: { transparency: 100 }, fill: { color: COLORS.teal } });
}

function renderTarget(pptx: PptxGenJS, slide: PptxGenJS.Slide, content: LearningObjectiveContent, context: LearningObjectiveRenderContext): void {
  const label = resolveLearningObjectiveSlot(TARGET_LAYOUT.slots[0]!.box, context);
  const objective = resolveLearningObjectiveSlot(TARGET_LAYOUT.slots[1]!.box, context);
  slide.background = { color: COLORS.navy };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: 7.5, line: { transparency: 100 }, fill: { color: COLORS.mint } });
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.82, y: 0.72, w: 7.22, h: 6.05, rectRadius: 0.08, line: { color: "DDE8E5", transparency: 30, pt: 0.8 }, fill: { color: COLORS.offWhite } });
  slide.addShape(pptx.ShapeType.rect, { x: 0.82, y: 0.72, w: 0.12, h: 6.05, line: { transparency: 100 }, fill: { color: COLORS.teal } });
  addText(slide, (content.label || "LEARNING OBJECTIVE").toUpperCase(), label, {
    fontFace: HEADING_FONTS[0], fontSize: 13, bold: true, charSpacing: 2, color: COLORS.teal,
  });
  addText(slide, content.objective, objective, {
    fontFace: BODY_FONTS[0], fontSize: objectiveFontSize(content.objective.length, [36, 31, 27]), bold: true,
    color: COLORS.navy, valign: "middle",
  });
  addText(slide, "OUR TARGET", { x: 8.72, y: 0.74, w: 3.65, h: 0.46 }, {
    fontFace: HEADING_FONTS[0], fontSize: 12, bold: true, charSpacing: 2.4, color: COLORS.mint, align: "center",
  });
  const rings = [3.55, 2.7, 1.84, 0.94];
  const fills = [COLORS.mint, COLORS.navy, COLORS.teal, COLORS.offWhite];
  rings.forEach((diameter, index) => {
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 10.545 - diameter / 2, y: 3.92 - diameter / 2, w: diameter, h: diameter,
      line: { color: index % 2 === 0 ? COLORS.mint : COLORS.teal, pt: index === 0 ? 2.2 : 1.3 },
      fill: { color: fills[index]!, transparency: index < 2 ? 100 : 0 },
    });
  });
  slide.addShape(pptx.ShapeType.line, { x: 10.56, y: 1.55, w: 0, h: 4.75, line: { color: COLORS.mint, transparency: 48, pt: 0.75 } });
  slide.addShape(pptx.ShapeType.line, { x: 8.18, y: 3.92, w: 4.75, h: 0, line: { color: COLORS.mint, transparency: 48, pt: 0.75 } });
  addText(slide, "FOCUS", { x: 9.72, y: 3.63, w: 1.68, h: 0.58 }, {
    fontFace: HEADING_FONTS[0], fontSize: 13, bold: true, color: COLORS.navy, align: "center",
  });
  addText(slide, "Clear purpose. Confident progress.", { x: 8.43, y: 6.62, w: 4.26, h: 0.34 }, {
    fontFace: BODY_FONTS[1], fontSize: 10.5, color: COLORS.mint, align: "center",
  });
}

export const STATEMENT_LAYOUT: LearningObjectiveLayoutDefinition = {
  id: "lo_statement_01",
  slideType: "learning-objective",
  aspectRatio: LAYAH_WIDESCREEN.aspectRatio,
  backgroundAsset: null,
  slots: [
    { name: "label", box: { x: 0.069, y: 0.207, width: 0.67, height: 0.055 }, required: false, maxCharacters: 32, maxLines: 1, minimumFontPoints: 14, fontFallbacks: HEADING_FONTS },
    { name: "objective", box: { x: 0.069, y: 0.285, width: 0.686, height: 0.47 }, required: true, maxCharacters: 280, maxLines: 6, minimumFontPoints: 28, fontFallbacks: BODY_FONTS },
  ],
  render: renderStatement,
};

export const TARGET_LAYOUT: LearningObjectiveLayoutDefinition = {
  id: "lo_target_01",
  slideType: "learning-objective",
  aspectRatio: LAYAH_WIDESCREEN.aspectRatio,
  backgroundAsset: null,
  slots: [
    { name: "label", box: { x: 0.086, y: 0.205, width: 0.45, height: 0.055 }, required: false, maxCharacters: 32, maxLines: 1, minimumFontPoints: 13, fontFallbacks: HEADING_FONTS },
    { name: "objective", box: { x: 0.086, y: 0.292, width: 0.462, height: 0.46 }, required: true, maxCharacters: 140, maxLines: 4, minimumFontPoints: 26, fontFallbacks: BODY_FONTS },
  ],
  render: renderTarget,
};

export const PROVISIONAL_LEARNING_OBJECTIVE_LAYOUTS = [STATEMENT_LAYOUT, TARGET_LAYOUT] as const;

export function getProvisionalLearningObjectiveLayout(id: ProvisionalLearningObjectiveLayoutId): LearningObjectiveLayoutDefinition {
  return id === "lo_statement_01" ? STATEMENT_LAYOUT : TARGET_LAYOUT;
}

export function resolveLearningObjectiveLayoutChoice(input: {
  content: LearningObjectiveContent;
  enabled: boolean;
  requested?: LearningObjectiveLayoutChoice;
}): LearningObjectiveLayoutChoice {
  if (input.requested === "existing") return "existing";
  if (input.requested) {
    const layout = getProvisionalLearningObjectiveLayout(input.requested);
    return learningObjectiveFits(layout, input.content) ? input.requested : "existing";
  }
  if (!input.enabled) return "existing";
  if (learningObjectiveFits(TARGET_LAYOUT, input.content)) return "lo_target_01";
  if (learningObjectiveFits(STATEMENT_LAYOUT, input.content)) return "lo_statement_01";
  return "existing";
}
