import type PptxGenJS from "pptxgenjs";

export const LAYAH_WIDESCREEN = Object.freeze({ width: 13.333, height: 7.5, aspectRatio: 16 / 9 });

export type LearningObjectiveSlotName = "label" | "objective";
export type LearningObjectiveContent = { objective: string; label?: string };
export type NormalizedSlideBox = { x: number; y: number; width: number; height: number };

export type LearningObjectiveSlot = {
  name: LearningObjectiveSlotName;
  box: NormalizedSlideBox;
  required: boolean;
  maxCharacters: number;
  maxLines: number;
  minimumFontPoints: number;
  fontFallbacks: readonly string[];
};

export type LearningObjectiveRenderContext = {
  slideWidth: number;
  slideHeight: number;
  textDirection: "ltr" | "rtl";
};

export type LearningObjectiveLayoutDefinition = {
  /** Must be copied from Yusuf's approved design package. */
  id: string;
  slideType: "learning-objective";
  aspectRatio: number;
  /** Repository-relative text-free PNG, or null when the background is drawn with native shapes. */
  backgroundAsset: string | null;
  slots: readonly LearningObjectiveSlot[];
  /** Non-text artwork bounds used by automated overlap checks; normalized to the slide canvas. */
  protectedRegions?: readonly NormalizedSlideBox[];
  render: (pptx: PptxGenJS, slide: PptxGenJS.Slide, content: LearningObjectiveContent, context: LearningObjectiveRenderContext) => void;
};

export type LayoutValidationIssue = { path: string; message: string };
export type LearningObjectiveFitIssueCode =
  | "missing_required_text"
  | "character_limit_exceeded"
  | "line_limit_exceeded"
  | "text_box_overflow"
  | "minimum_font_unreadable"
  | "invalid_layout";
export type LearningObjectiveFitIssue = {
  code: LearningObjectiveFitIssueCode;
  slot: LearningObjectiveSlotName | "layout";
  message: string;
};

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function boxesOverlap(left: NormalizedSlideBox, right: NormalizedSlideBox): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
}

export function validateLearningObjectiveLayout(definition: LearningObjectiveLayoutDefinition): LayoutValidationIssue[] {
  const issues: LayoutValidationIssue[] = [];
  if (!definition.id.trim()) issues.push({ path: "id", message: "An approved layout ID is required." });
  if (definition.slideType !== "learning-objective") issues.push({ path: "slideType", message: "Phase 1 layouts must target learning-objective only." });
  if (Math.abs(definition.aspectRatio - LAYAH_WIDESCREEN.aspectRatio) > 0.001) issues.push({ path: "aspectRatio", message: "The approved design must use a 16:9 canvas." });
  if (definition.backgroundAsset !== null && !definition.backgroundAsset.trim().toLowerCase().endsWith(".png")) issues.push({ path: "backgroundAsset", message: "A supplied text-free background must be a PNG." });

  const names = new Set<LearningObjectiveSlotName>();
  definition.slots.forEach((slot, index) => {
    const path = `slots[${index}]`;
    if (names.has(slot.name)) issues.push({ path: `${path}.name`, message: "Slot names must be unique." });
    names.add(slot.name);
    const { x, y, width, height } = slot.box;
    if (![x, y, width, height].every(isUnitInterval) || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
      issues.push({ path: `${path}.box`, message: "Slot bounds must fit inside the normalized slide canvas." });
    }
    if (!Number.isInteger(slot.maxCharacters) || slot.maxCharacters <= 0) issues.push({ path: `${path}.maxCharacters`, message: "Each slot needs a positive character limit." });
    if (!Number.isInteger(slot.maxLines) || slot.maxLines <= 0) issues.push({ path: `${path}.maxLines`, message: "Each slot needs a positive line limit." });
    const minimumAllowed = slot.name === "objective" ? 17 : 10;
    if (!Number.isFinite(slot.minimumFontPoints) || slot.minimumFontPoints < minimumAllowed) issues.push({ path: `${path}.minimumFontPoints`, message: `${slot.name === "objective" ? "Objective" : "Label"} text must remain at least ${minimumAllowed} pt.` });
    if (slot.fontFallbacks.length === 0 || slot.fontFallbacks.some((font) => !font.trim())) issues.push({ path: `${path}.fontFallbacks`, message: "Each slot needs at least one usable font fallback." });
  });
  definition.slots.forEach((slot, index) => {
    definition.slots.slice(index + 1).forEach((other) => {
      if (boxesOverlap(slot.box, other.box)) issues.push({ path: `slots[${index}].box`, message: `Text slot ${slot.name} overlaps text slot ${other.name}.` });
    });
    definition.protectedRegions?.forEach((region, regionIndex) => {
      if (boxesOverlap(slot.box, region)) issues.push({ path: `slots[${index}].box`, message: `Text slot ${slot.name} overlaps protected visual region ${regionIndex}.` });
    });
  });
  if (!names.has("objective")) issues.push({ path: "slots", message: "An objective slot is required." });
  return issues;
}

export function learningObjectiveFits(definition: LearningObjectiveLayoutDefinition, content: LearningObjectiveContent): boolean {
  return validateLearningObjectiveFit(definition, content).length === 0;
}

function estimatedWrappedLines(text: string, widthInches: number, fontPoints: number): number {
  if (!text.trim()) return 0;
  // Conservative classroom-font estimate. Poppins and the declared fallbacks average roughly
  // 0.52em per character; the small safety factor prevents PptxGenJS shrink-to-fit from becoming
  // the primary layout mechanism.
  const usablePoints = Math.max(1, widthInches * 72);
  const charactersPerLine = Math.max(1, Math.floor(usablePoints / (fontPoints * 0.56)));
  return text.split(/\r?\n/).reduce((total, line) => total + Math.max(1, Math.ceil(line.trim().length / charactersPerLine)), 0);
}

function maximumLinesByHeight(heightInches: number, fontPoints: number): number {
  const lineHeightPoints = fontPoints * 1.18;
  return Math.max(1, Math.floor((heightInches * 72) / lineHeightPoints));
}

/** Detailed, content-safe fit check used by selection, diagnostics, and regression tests. */
export function validateLearningObjectiveFit(
  definition: LearningObjectiveLayoutDefinition,
  content: LearningObjectiveContent,
): LearningObjectiveFitIssue[] {
  const definitionIssues = validateLearningObjectiveLayout(definition);
  if (definitionIssues.length > 0) {
    return definitionIssues.map((issue) => ({ code: "invalid_layout", slot: "layout", message: `${issue.path}: ${issue.message}` }));
  }
  const values: Record<LearningObjectiveSlotName, string> = { label: content.label?.trim() ?? "", objective: content.objective.trim() };
  const issues: LearningObjectiveFitIssue[] = [];
  definition.slots.forEach((slot) => {
    const value = values[slot.name];
    if (slot.required && !value) {
      issues.push({ code: "missing_required_text", slot: slot.name, message: `${slot.name} text is required.` });
      return;
    }
    if (!value) return;
    if (value.length > slot.maxCharacters) {
      issues.push({ code: "character_limit_exceeded", slot: slot.name, message: `${slot.name} has ${value.length} characters; maximum is ${slot.maxCharacters}.` });
    }
    const explicitLines = value.split(/\r?\n/).length;
    if (explicitLines > slot.maxLines) {
      issues.push({ code: "line_limit_exceeded", slot: slot.name, message: `${slot.name} has ${explicitLines} explicit lines; maximum is ${slot.maxLines}.` });
    }
    if (slot.minimumFontPoints < (slot.name === "objective" ? 17 : 10)) {
      issues.push({ code: "minimum_font_unreadable", slot: slot.name, message: `${slot.name} falls below the readable font minimum.` });
    }
    const width = slot.box.width * LAYAH_WIDESCREEN.width;
    const height = slot.box.height * LAYAH_WIDESCREEN.height;
    const estimatedLines = estimatedWrappedLines(value, width, slot.minimumFontPoints);
    const heightLines = maximumLinesByHeight(height, slot.minimumFontPoints);
    if (estimatedLines > Math.min(slot.maxLines, heightLines)) {
      issues.push({ code: "text_box_overflow", slot: slot.name, message: `${slot.name} needs about ${estimatedLines} lines at ${slot.minimumFontPoints} pt; the box supports ${Math.min(slot.maxLines, heightLines)}.` });
    }
  });
  return issues;
}

export function resolveLearningObjectiveSlot(box: NormalizedSlideBox, context: Pick<LearningObjectiveRenderContext, "slideWidth" | "slideHeight">) {
  return { x: box.x * context.slideWidth, y: box.y * context.slideHeight, w: box.width * context.slideWidth, h: box.height * context.slideHeight };
}
