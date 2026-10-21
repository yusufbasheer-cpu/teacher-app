import PptxGenJS from "pptxgenjs";
import { estimateTextHeight } from "@/lib/ppt-design-system";
import { drawRoundedImageFrame } from "@/lib/ppt-render-primitives";
import type { TemplateConfig } from "@/lib/ppt-template-config";

export type Phase4ATitleLayoutId = "title_hero_01" | "title_typography_01";
export type Phase4AStarterLayoutId = "starter_activity_brief_01" | "starter_visual_prompt_01";
export type Phase4ALayoutId = Phase4ATitleLayoutId | Phase4AStarterLayoutId;

export type LayoutImageAsset = {
  dataUri: string;
  width?: number;
  height?: number;
};

export type TitleLayoutContent = {
  topic: string;
  subject: string;
  grade: string;
  hasImage: boolean;
};

export type StarterActivityKind = "picture-prompt" | "retrieval" | "odd-one-out" | "discussion" | "general";

export type StarterLayoutContent = {
  title: string;
  body: string;
  activityKind: StarterActivityKind;
  selectedToolIds: readonly string[];
  hasImage: boolean;
};

export type Phase4ARenderContext = {
  template: TemplateConfig;
  image: LayoutImageAsset | null;
  textDirection: "ltr" | "rtl";
};

export type Phase4ASlot = {
  name: string;
  maxCharacters: number;
  maxLines: number;
  minimumFontPoints: number;
};

export type TitleLayoutDefinition = {
  id: Phase4ATitleLayoutId;
  slideType: "title";
  family: "hero" | "typography";
  provisional: true;
  slots: readonly Phase4ASlot[];
  fits: (content: TitleLayoutContent) => boolean;
  render: (pptx: PptxGenJS, slide: PptxGenJS.Slide, content: TitleLayoutContent, context: Phase4ARenderContext) => void;
};

export type StarterLayoutDefinition = {
  id: Phase4AStarterLayoutId;
  slideType: "starter";
  family: "activity-brief" | "visual-prompt";
  provisional: true;
  slots: readonly Phase4ASlot[];
  fits: (content: StarterLayoutContent) => boolean;
  render: (pptx: PptxGenJS, slide: PptxGenJS.Slide, content: StarterLayoutContent, context: Phase4ARenderContext) => void;
};

const COLORS = {
  navy: "102A43",
  navyLight: "173B58",
  teal: "0F8B8D",
  mint: "BEE9E8",
  offWhite: "F7F5EF",
  white: "FFFFFF",
  muted: "526777",
  line: "D7E5E4",
} as const;

const HEADING_FONT = "Poppins";
const BODY_FONT = "Arial";

function addText(slide: PptxGenJS.Slide, text: string, box: { x: number; y: number; w: number; h: number }, options: PptxGenJS.TextPropsOptions): void {
  slide.addText(text, {
    ...box,
    margin: 0,
    breakLine: false,
    fit: "shrink",
    valign: "middle",
    fontFace: BODY_FONT,
    ...options,
  });
}

function titleSize(length: number): number {
  if (length <= 34) return 34;
  if (length <= 62) return 29;
  return 25;
}

function starterBodySize(length: number): number {
  if (length <= 260) return 22;
  if (length <= 520) return 19;
  return 16;
}

function drawImage(slide: PptxGenJS.Slide, pptx: PptxGenJS, context: Phase4ARenderContext, box: { x: number; y: number; w: number; h: number }, altText: string): void {
  if (!context.image) return;
  drawRoundedImageFrame(pptx, slide, {
    ...box,
    imageDataUri: context.image.dataUri,
    naturalWidth: context.image.width,
    naturalHeight: context.image.height,
    tpl: context.template,
    altText,
  });
}

function renderTitleHero(pptx: PptxGenJS, slide: PptxGenJS.Slide, content: TitleLayoutContent, context: Phase4ARenderContext): void {
  slide.background = { color: COLORS.navy };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 7.55, h: 7.5, line: { transparency: 100 }, fill: { color: COLORS.navy } });
  slide.addShape(pptx.ShapeType.rect, { x: 7.36, y: 0, w: 0.2, h: 7.5, line: { transparency: 100 }, fill: { color: COLORS.teal } });
  drawImage(slide, pptx, context, { x: 7.52, y: 1.34, w: 5.46, h: 4.34 }, `${content.topic} lesson image`);
  addText(slide, `${content.subject.toUpperCase()}  /  ${content.grade.toUpperCase()}`, { x: 0.8, y: 0.78, w: 5.9, h: 0.38 }, {
    fontFace: HEADING_FONT, fontSize: 13, bold: true, charSpacing: 1.8, color: COLORS.mint,
  });
  addText(slide, content.topic, { x: 0.78, y: 1.45, w: 5.95, h: 3.2 }, {
    fontFace: HEADING_FONT, fontSize: titleSize(content.topic.length) + 5, bold: true, color: COLORS.offWhite,
    valign: "middle", breakLine: false,
  });
  slide.addShape(pptx.ShapeType.line, { x: 0.8, y: 5.03, w: 2.35, h: 0, line: { color: COLORS.teal, pt: 4 } });
  addText(slide, "LESSON PRESENTATION", { x: 0.8, y: 5.28, w: 3.8, h: 0.4 }, {
    fontFace: HEADING_FONT, fontSize: 12, bold: true, charSpacing: 1.8, color: COLORS.white, transparency: 12,
  });
}

function renderTitleTypography(pptx: PptxGenJS, slide: PptxGenJS.Slide, content: TitleLayoutContent): void {
  slide.background = { color: COLORS.offWhite };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, line: { transparency: 100 }, fill: { color: COLORS.teal } });
  slide.addShape(pptx.ShapeType.arc, { x: 9.42, y: -1.0, w: 4.45, h: 4.45, rotate: 18, line: { color: COLORS.mint, pt: 18, transparency: 12 }, fill: { transparency: 100 } });
  slide.addShape(pptx.ShapeType.arc, { x: 10.28, y: 4.86, w: 2.95, h: 2.95, rotate: 198, line: { color: COLORS.teal, pt: 9, transparency: 8 }, fill: { transparency: 100 } });
  addText(slide, `${content.subject.toUpperCase()}  /  ${content.grade.toUpperCase()}`, { x: 0.92, y: 0.8, w: 5.9, h: 0.36 }, {
    fontFace: HEADING_FONT, fontSize: 13, bold: true, charSpacing: 1.8, color: COLORS.teal,
  });
  addText(slide, content.topic, { x: 0.9, y: 1.58, w: 9.35, h: 3.1 }, {
    fontFace: HEADING_FONT, fontSize: titleSize(content.topic.length) + 10, bold: true, color: COLORS.navy,
    valign: "middle",
  });
  slide.addShape(pptx.ShapeType.line, { x: 0.92, y: 5.05, w: 4.25, h: 0, line: { color: COLORS.teal, pt: 4 } });
  addText(slide, "LESSON PRESENTATION", { x: 0.92, y: 5.33, w: 4.2, h: 0.38 }, {
    fontFace: HEADING_FONT, fontSize: 12, bold: true, charSpacing: 1.8, color: COLORS.muted,
  });
  slide.addShape(pptx.ShapeType.ellipse, { x: 10.85, y: 2.44, w: 0.28, h: 0.28, line: { transparency: 100 }, fill: { color: COLORS.teal } });
  slide.addShape(pptx.ShapeType.ellipse, { x: 11.42, y: 2.44, w: 0.28, h: 0.28, line: { transparency: 100 }, fill: { color: COLORS.mint } });
  slide.addShape(pptx.ShapeType.ellipse, { x: 11.99, y: 2.44, w: 0.28, h: 0.28, line: { transparency: 100 }, fill: { color: COLORS.navy } });
}

function activityLabel(kind: StarterActivityKind): string {
  if (kind === "picture-prompt") return "OBSERVE  /  THINK  /  EXPLAIN";
  if (kind === "retrieval") return "RETRIEVE  /  CHECK  /  IMPROVE";
  if (kind === "odd-one-out") return "COMPARE  /  CHOOSE  /  JUSTIFY";
  if (kind === "discussion") return "THINK  /  PAIR  /  SHARE";
  return "START  /  DISCUSS  /  RESPOND";
}

function renderStarterActivityBrief(pptx: PptxGenJS, slide: PptxGenJS.Slide, content: StarterLayoutContent): void {
  slide.background = { color: COLORS.offWhite };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.14, line: { transparency: 100 }, fill: { color: COLORS.teal } });
  addText(slide, "STARTER ACTIVITY", { x: 0.78, y: 0.56, w: 3.4, h: 0.35 }, {
    fontFace: HEADING_FONT, fontSize: 13, bold: true, charSpacing: 1.9, color: COLORS.teal,
  });
  addText(slide, content.title, { x: 0.76, y: 1.03, w: 8.7, h: 0.72 }, {
    fontFace: HEADING_FONT, fontSize: 30, bold: true, color: COLORS.navy,
  });
  addText(slide, activityLabel(content.activityKind), { x: 9.55, y: 1.14, w: 2.95, h: 0.34 }, {
    fontFace: HEADING_FONT, fontSize: 10.5, bold: true, charSpacing: 1.25, color: COLORS.teal, align: "right",
  });
  slide.addShape(pptx.ShapeType.line, { x: 0.78, y: 1.92, w: 11.75, h: 0, line: { color: COLORS.line, pt: 1.1 } });
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.78, y: 2.28, w: 0.72, h: 0.72, rectRadius: 0.18, line: { color: COLORS.teal, pt: 1.5 }, fill: { color: COLORS.mint, transparency: 12 } });
  addText(slide, "1", { x: 0.78, y: 2.28, w: 0.72, h: 0.72 }, { fontFace: HEADING_FONT, fontSize: 22, bold: true, color: COLORS.navy, align: "center" });
  addText(slide, content.body, { x: 1.82, y: 2.12, w: 10.55, h: 3.95 }, {
    fontFace: BODY_FONT, fontSize: starterBodySize(content.body.length), color: COLORS.navy, valign: "top", breakLine: false,
    paraSpaceAfter: 9, lineSpacingMultiple: 1.08,
  });
  slide.addShape(pptx.ShapeType.line, { x: 1.82, y: 6.43, w: 5.0, h: 0, line: { color: COLORS.teal, pt: 3 } });
}

function renderStarterVisualPrompt(pptx: PptxGenJS, slide: PptxGenJS.Slide, content: StarterLayoutContent, context: Phase4ARenderContext): void {
  slide.background = { color: COLORS.navy };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: 7.5, line: { transparency: 100 }, fill: { color: COLORS.mint } });
  addText(slide, "STARTER ACTIVITY", { x: 0.78, y: 0.52, w: 3.5, h: 0.36 }, {
    fontFace: HEADING_FONT, fontSize: 13, bold: true, charSpacing: 1.9, color: COLORS.mint,
  });
  addText(slide, activityLabel(content.activityKind), { x: 0.78, y: 1.04, w: 5.7, h: 0.42 }, {
    fontFace: HEADING_FONT, fontSize: 13, bold: true, charSpacing: 1.2, color: COLORS.teal,
  });
  drawImage(slide, pptx, context, { x: 7.45, y: 1.46, w: 5.18, h: 4.18 }, "Starter activity prompt image");
  addText(slide, content.body, { x: 0.78, y: 1.72, w: 5.92, h: 4.55 }, {
    fontFace: BODY_FONT, fontSize: starterBodySize(content.body.length) + 1, color: COLORS.offWhite,
    valign: "top", paraSpaceAfter: 9, lineSpacingMultiple: 1.08,
  });
  slide.addShape(pptx.ShapeType.line, { x: 0.8, y: 6.62, w: 5.85, h: 0, line: { color: COLORS.teal, pt: 3 } });
}

const TITLE_SLOTS = [
  { name: "topic", maxCharacters: 90, maxLines: 4, minimumFontPoints: 25 },
  { name: "subject", maxCharacters: 60, maxLines: 1, minimumFontPoints: 13 },
  { name: "grade", maxCharacters: 40, maxLines: 1, minimumFontPoints: 13 },
] as const;

const STARTER_SLOTS = [
  { name: "title", maxCharacters: 80, maxLines: 2, minimumFontPoints: 26 },
  { name: "body", maxCharacters: 900, maxLines: 15, minimumFontPoints: 16 },
] as const;

export const TITLE_HERO_LAYOUT: TitleLayoutDefinition = {
  id: "title_hero_01",
  slideType: "title",
  family: "hero",
  provisional: true,
  slots: TITLE_SLOTS,
  fits: (content) => content.hasImage && content.topic.trim().length > 0 && content.topic.length <= 90 && content.subject.length <= 60 && content.grade.length <= 40,
  render: renderTitleHero,
};

export const TITLE_TYPOGRAPHY_LAYOUT: TitleLayoutDefinition = {
  id: "title_typography_01",
  slideType: "title",
  family: "typography",
  provisional: true,
  slots: TITLE_SLOTS,
  fits: (content) => content.topic.trim().length > 0 && content.topic.length <= 90 && content.subject.length <= 60 && content.grade.length <= 40,
  render: renderTitleTypography,
};

export const STARTER_ACTIVITY_BRIEF_LAYOUT: StarterLayoutDefinition = {
  id: "starter_activity_brief_01",
  slideType: "starter",
  family: "activity-brief",
  provisional: true,
  slots: STARTER_SLOTS,
  fits: (content) => content.title.length <= 80 && content.body.trim().length > 0 && content.body.length <= 900
    && estimateTextHeight(content.body, 10.55, starterBodySize(content.body.length)) <= 3.95,
  render: renderStarterActivityBrief,
};

export const STARTER_VISUAL_PROMPT_LAYOUT: StarterLayoutDefinition = {
  id: "starter_visual_prompt_01",
  slideType: "starter",
  family: "visual-prompt",
  provisional: true,
  slots: STARTER_SLOTS,
  fits: (content) => content.hasImage && content.title.length <= 80 && content.body.trim().length > 0 && content.body.length <= 700
    && estimateTextHeight(content.body, 5.92, starterBodySize(content.body.length) + 1) <= 4.55,
  render: renderStarterVisualPrompt,
};

export const PROVISIONAL_PHASE4A_LAYOUTS = [
  TITLE_HERO_LAYOUT,
  TITLE_TYPOGRAPHY_LAYOUT,
  STARTER_ACTIVITY_BRIEF_LAYOUT,
  STARTER_VISUAL_PROMPT_LAYOUT,
] as const;

export function classifyStarterActivity(body: string, selectedToolIds: readonly string[] = []): StarterActivityKind {
  const haystack = `${selectedToolIds.join(" ")} ${body}`.toLowerCase();
  if (/picture.prompt|image|photograph|observe/.test(haystack)) return "picture-prompt";
  if (/odd.one.out|which does not belong/.test(haystack)) return "odd-one-out";
  if (/retrieval|quiz|recall|entry.ticket/.test(haystack)) return "retrieval";
  if (/think.pair.share|discuss|partner/.test(haystack)) return "discussion";
  return "general";
}
