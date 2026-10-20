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
  /** Repository-relative path to the approved text-free PNG. */
  backgroundAsset: string;
  slots: readonly LearningObjectiveSlot[];
  render: (slide: PptxGenJS.Slide, content: LearningObjectiveContent, context: LearningObjectiveRenderContext) => void;
};

export type LayoutValidationIssue = { path: string; message: string };

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateLearningObjectiveLayout(definition: LearningObjectiveLayoutDefinition): LayoutValidationIssue[] {
  const issues: LayoutValidationIssue[] = [];
  if (!definition.id.trim()) issues.push({ path: "id", message: "An approved layout ID is required." });
  if (definition.slideType !== "learning-objective") issues.push({ path: "slideType", message: "Phase 1 layouts must target learning-objective only." });
  if (Math.abs(definition.aspectRatio - LAYAH_WIDESCREEN.aspectRatio) > 0.001) issues.push({ path: "aspectRatio", message: "The approved design must use a 16:9 canvas." });
  if (!definition.backgroundAsset.trim().toLowerCase().endsWith(".png")) issues.push({ path: "backgroundAsset", message: "The approved text-free background must be a PNG." });

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
    if (!Number.isFinite(slot.minimumFontPoints) || slot.minimumFontPoints < 17) issues.push({ path: `${path}.minimumFontPoints`, message: "Body text must remain at least 17 pt." });
    if (slot.fontFallbacks.length === 0 || slot.fontFallbacks.some((font) => !font.trim())) issues.push({ path: `${path}.fontFallbacks`, message: "Each slot needs at least one usable font fallback." });
  });
  if (!names.has("objective")) issues.push({ path: "slots", message: "An objective slot is required." });
  return issues;
}

export function learningObjectiveFits(definition: LearningObjectiveLayoutDefinition, content: LearningObjectiveContent): boolean {
  if (validateLearningObjectiveLayout(definition).length > 0) return false;
  const values: Record<LearningObjectiveSlotName, string> = { label: content.label?.trim() ?? "", objective: content.objective.trim() };
  return definition.slots.every((slot) => {
    const value = values[slot.name];
    if (slot.required && !value) return false;
    if (!value) return true;
    return value.length <= slot.maxCharacters && value.split(/\r?\n/).length <= slot.maxLines;
  });
}

export function resolveLearningObjectiveSlot(box: NormalizedSlideBox, context: Pick<LearningObjectiveRenderContext, "slideWidth" | "slideHeight">) {
  return { x: box.x * context.slideWidth, y: box.y * context.slideHeight, w: box.width * context.slideWidth, h: box.height * context.slideHeight };
}
