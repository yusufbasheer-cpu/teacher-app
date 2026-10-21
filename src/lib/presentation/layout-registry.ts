import type PptxGenJS from "pptxgenjs";
import {
  STATEMENT_LAYOUT,
  TARGET_LAYOUT,
  type ProvisionalLearningObjectiveLayoutId,
} from "@/lib/ppt-layouts/learning-objective-provisional";
import {
  learningObjectiveFits,
  validateLearningObjectiveFit,
  type LearningObjectiveContent,
  type LearningObjectiveRenderContext,
  type LearningObjectiveSlot,
} from "@/lib/ppt-layouts/learning-objective-layout";
import {
  PROVISIONAL_PHASE4A_LAYOUTS,
  type Phase4ARenderContext,
  type Phase4ASlot,
  type Phase4AStarterLayoutId,
  type Phase4ATitleLayoutId,
  type StarterLayoutContent,
  type TitleLayoutContent,
} from "@/lib/ppt-layouts/title-starter-provisional";

export type LayoutId = string;
export type LayoutFamily = "statement" | "target" | string;

/** Proposal-level design-library roles. Registration remains limited to learning-objective in Phase 2. */
export const DESIGN_LIBRARY_SLIDE_TYPES = [
  "title",
  "learning-objective",
  "success-criteria",
  "starter",
  "teacher-input",
  "modelling",
  "guided-practice",
  "independent-practice",
  "differentiation",
  "mini-plenary",
  "afl-activity",
  "plenary",
  "exit-ticket",
] as const;
export type DesignLibrarySlideType = (typeof DESIGN_LIBRARY_SLIDE_TYPES)[number];

export type RegisteredLayoutDefinition<TContent = unknown, TContext = unknown, TContentLimits = unknown> = {
  id: LayoutId;
  slideType: DesignLibrarySlideType;
  family: LayoutFamily;
  contentLimits: TContentLimits;
  fits: (content: TContent) => boolean;
  render: (pptx: PptxGenJS, slide: PptxGenJS.Slide, content: TContent, context: TContext) => void;
};

export type LearningObjectiveRegistryEntry = RegisteredLayoutDefinition<
  LearningObjectiveContent,
  LearningObjectiveRenderContext,
  { slots: readonly LearningObjectiveSlot[] }
>;

export type TitleRegistryEntry = RegisteredLayoutDefinition<
  TitleLayoutContent,
  Phase4ARenderContext,
  { slots: readonly Phase4ASlot[]; provisional: true }
>;

export type StarterRegistryEntry = RegisteredLayoutDefinition<
  StarterLayoutContent,
  Phase4ARenderContext,
  { slots: readonly Phase4ASlot[]; provisional: true }
>;

export type AnyRegisteredLayout = LearningObjectiveRegistryEntry | TitleRegistryEntry | StarterRegistryEntry;

/** The approved Phase 3 budget is derived from registered layout slots, never duplicated in prompts. */
export function getLearningObjectiveContentBudget(): { preferredMaximumCharacters: number; absoluteRegisteredMaximumCharacters: number } {
  const limits = LEARNING_OBJECTIVE_LAYOUTS.map((layout) => layout.contentLimits.slots.find((slot) => slot.name === "objective")?.maxCharacters ?? 0);
  return {
    preferredMaximumCharacters: Math.min(...limits.filter((limit) => limit > 0)),
    absoluteRegisteredMaximumCharacters: Math.max(...limits),
  };
}

export function getLearningObjectiveFitFailures(layout: LearningObjectiveRegistryEntry, content: LearningObjectiveContent) {
  const definition = layout.id === STATEMENT_LAYOUT.id ? STATEMENT_LAYOUT : TARGET_LAYOUT;
  return validateLearningObjectiveFit(definition, content);
}

const LEARNING_OBJECTIVE_LAYOUTS: readonly LearningObjectiveRegistryEntry[] = [
  {
    id: "lo_statement_01",
    slideType: "learning-objective",
    family: "statement",
    contentLimits: { slots: STATEMENT_LAYOUT.slots },
    fits: (content) => learningObjectiveFits(STATEMENT_LAYOUT, content),
    render: STATEMENT_LAYOUT.render,
  },
  {
    id: "lo_target_01",
    slideType: "learning-objective",
    family: "target",
    contentLimits: { slots: TARGET_LAYOUT.slots },
    fits: (content) => learningObjectiveFits(TARGET_LAYOUT, content),
    render: TARGET_LAYOUT.render,
  },
] as const;

const TITLE_LAYOUTS: readonly TitleRegistryEntry[] = PROVISIONAL_PHASE4A_LAYOUTS
  .filter((layout) => layout.slideType === "title")
  .map((layout) => ({
    id: layout.id,
    slideType: layout.slideType,
    family: layout.family,
    contentLimits: { slots: layout.slots, provisional: true },
    fits: layout.fits,
    render: layout.render,
  })) as readonly TitleRegistryEntry[];

const STARTER_LAYOUTS: readonly StarterRegistryEntry[] = PROVISIONAL_PHASE4A_LAYOUTS
  .filter((layout) => layout.slideType === "starter")
  .map((layout) => ({
    id: layout.id,
    slideType: layout.slideType,
    family: layout.family,
    contentLimits: { slots: layout.slots, provisional: true },
    fits: layout.fits,
    render: layout.render,
  })) as readonly StarterRegistryEntry[];

/** Code-versioned registry. Phase 4A adds provisional title and starter layouts only. */
export const LAYOUT_REGISTRY: readonly AnyRegisteredLayout[] = [
  ...LEARNING_OBJECTIVE_LAYOUTS,
  ...TITLE_LAYOUTS,
  ...STARTER_LAYOUTS,
];

export function getRegisteredLayout(id: ProvisionalLearningObjectiveLayoutId): LearningObjectiveRegistryEntry | null;
export function getRegisteredLayout(id: Phase4ATitleLayoutId): TitleRegistryEntry | null;
export function getRegisteredLayout(id: Phase4AStarterLayoutId): StarterRegistryEntry | null;
export function getRegisteredLayout(id: LayoutId): AnyRegisteredLayout | null;
export function getRegisteredLayout(id: LayoutId): AnyRegisteredLayout | null {
  return LAYOUT_REGISTRY.find((layout) => layout.id === id) ?? null;
}

export function getRegisteredLayoutsForSlideType(slideType: "learning-objective"): readonly LearningObjectiveRegistryEntry[];
export function getRegisteredLayoutsForSlideType(slideType: "title"): readonly TitleRegistryEntry[];
export function getRegisteredLayoutsForSlideType(slideType: "starter"): readonly StarterRegistryEntry[];
export function getRegisteredLayoutsForSlideType(slideType: DesignLibrarySlideType): readonly AnyRegisteredLayout[];
export function getRegisteredLayoutsForSlideType(slideType: DesignLibrarySlideType): readonly AnyRegisteredLayout[] {
  return LAYOUT_REGISTRY.filter((layout) => layout.slideType === slideType);
}

export function getTitleFitFailures(layout: TitleRegistryEntry, content: TitleLayoutContent): string[] {
  const issues: string[] = [];
  if (!content.topic.trim()) issues.push("required:topic");
  if (content.topic.length > 90) issues.push("character_limit_exceeded:topic");
  if (content.subject.length > 60) issues.push("character_limit_exceeded:subject");
  if (content.grade.length > 40) issues.push("character_limit_exceeded:grade");
  if (layout.family === "hero" && !content.hasImage) issues.push("image_required:hero");
  return issues;
}

export function getStarterFitFailures(layout: StarterRegistryEntry, content: StarterLayoutContent): string[] {
  const issues: string[] = [];
  if (!content.body.trim()) issues.push("required:body");
  if (content.title.length > 80) issues.push("character_limit_exceeded:title");
  const limit = layout.family === "visual-prompt" ? 700 : 900;
  if (content.body.length > limit) issues.push("character_limit_exceeded:body");
  if (layout.family === "visual-prompt" && !content.hasImage) issues.push("image_required:visual-prompt");
  if (issues.length === 0 && !layout.fits(content)) issues.push("estimated_text_overflow:body");
  return issues;
}
