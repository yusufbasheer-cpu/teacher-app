import type PptxGenJS from "pptxgenjs";
import {
  STATEMENT_LAYOUT,
  TARGET_LAYOUT,
} from "@/lib/ppt-layouts/learning-objective-provisional";
import {
  learningObjectiveFits,
  type LearningObjectiveContent,
  type LearningObjectiveRenderContext,
  type LearningObjectiveSlot,
} from "@/lib/ppt-layouts/learning-objective-layout";

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

/** Code-versioned registry. Phase 2 intentionally registers only approved learning-objective layouts. */
export const LAYOUT_REGISTRY: readonly LearningObjectiveRegistryEntry[] = LEARNING_OBJECTIVE_LAYOUTS;

export function getRegisteredLayout(id: LayoutId): LearningObjectiveRegistryEntry | null {
  return LEARNING_OBJECTIVE_LAYOUTS.find((layout) => layout.id === id) ?? null;
}

export function getRegisteredLayoutsForSlideType(slideType: DesignLibrarySlideType): readonly LearningObjectiveRegistryEntry[] {
  return LAYOUT_REGISTRY.filter((layout) => layout.slideType === slideType);
}
