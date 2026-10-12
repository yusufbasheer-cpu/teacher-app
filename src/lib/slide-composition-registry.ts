import type {
  EducationalCompositionId,
  EducationalContentBlock,
  PedagogicalPurpose,
} from "@/lib/slide-schema";

export type SlideRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type EducationalCompositionDefinition = {
  id: EducationalCompositionId;
  version: 1;
  label: string;
  supportedPurposes: readonly PedagogicalPurpose[];
  supportedBlocks: readonly EducationalContentBlock["type"][];
  hierarchy: readonly string[];
  regions: Readonly<Record<string, SlideRegion>>;
  density: {
    preferred: "light" | "moderate" | "dense";
    maxCharacters: number;
    maxItems: number;
  };
  imagePolicy: "avoid" | "optional" | "prefer";
  minimumBodyFontPt: number;
  fallbacks: readonly EducationalCompositionId[];
  variants: readonly string[];
};

const commonText = ["paragraph", "keyIdea", "bulletList"] as const;

/**
 * Versioned, educationally bounded compositions. Regions use a 13.333 x 7.5 inch slide
 * coordinate system and are consumed by the PptxGenJS renderer; the model never supplies them.
 */
export const SLIDE_COMPOSITION_REGISTRY: Readonly<Record<EducationalCompositionId, EducationalCompositionDefinition>> = {
  "concept-focus": {
    id: "concept-focus", version: 1, label: "Concept focus",
    supportedPurposes: ["concept-explanation", "context", "connection", "opening", "diagram"],
    supportedBlocks: [...commonText, "orderedSteps"],
    hierarchy: ["central-takeaway", "supporting-explanation", "optional-image"],
    regions: {
      takeaway: { x: 0.72, y: 1.62, w: 7.05, h: 1.65 },
      support: { x: 0.78, y: 3.55, w: 7.0, h: 2.95 },
      image: { x: 8.3, y: 1.75, w: 4.32, h: 4.72 },
    },
    density: { preferred: "light", maxCharacters: 1250, maxItems: 5 },
    imagePolicy: "optional", minimumBodyFontPt: 17,
    fallbacks: ["definition-and-example"], variants: ["takeaway-with-evidence", "image-right", "text-only"] ,
  },
  "definition-and-example": {
    id: "definition-and-example", version: 1, label: "Definition and example",
    supportedPurposes: ["concept-explanation", "context", "connection"],
    supportedBlocks: [...commonText, "workedExample"],
    hierarchy: ["definition", "example", "why-it-matters"],
    regions: {
      definition: { x: 0.72, y: 1.7, w: 4.45, h: 4.72 },
      example: { x: 5.55, y: 1.7, w: 7.05, h: 4.72 },
    },
    density: { preferred: "moderate", maxCharacters: 1450, maxItems: 8 },
    imagePolicy: "optional", minimumBodyFontPt: 16,
    fallbacks: ["concept-focus"], variants: ["paired-definition-example", "example-led"],
  },
  "worked-example-steps": {
    id: "worked-example-steps", version: 1, label: "Worked example",
    supportedPurposes: ["worked-example", "concept-explanation"],
    supportedBlocks: [...commonText, "orderedSteps", "workedExample"],
    hierarchy: ["problem", "numbered-reasoning", "result"],
    regions: {
      problem: { x: 0.72, y: 1.72, w: 3.2, h: 4.75 },
      reasoning: { x: 4.35, y: 1.7, w: 8.25, h: 4.84 },
    },
    density: { preferred: "moderate", maxCharacters: 1550, maxItems: 7 },
    imagePolicy: "avoid", minimumBodyFontPt: 16,
    fallbacks: ["process-flow", "concept-focus"], variants: ["vertical-reasoning", "equation-led"],
  },
  "labeled-diagram": {
    id: "labeled-diagram", version: 1, label: "Labeled diagram",
    supportedPurposes: ["diagram", "concept-explanation", "connection"],
    supportedBlocks: [...commonText, "diagram"],
    hierarchy: ["diagram-relationships", "node-labels", "central-takeaway"],
    regions: {
      diagram: { x: 0.82, y: 1.62, w: 11.7, h: 4.68 },
      caption: { x: 0.92, y: 6.38, w: 11.45, h: 0.38 },
    },
    density: { preferred: "moderate", maxCharacters: 1150, maxItems: 9 },
    imagePolicy: "avoid", minimumBodyFontPt: 15,
    fallbacks: ["concept-focus"], variants: ["cause-and-effect", "radial-concept-map", "sequence"],
  },
  "process-flow": {
    id: "process-flow", version: 1, label: "Process sequence",
    supportedPurposes: ["process", "worked-example", "concept-explanation"],
    supportedBlocks: [...commonText, "orderedSteps", "task"],
    hierarchy: ["sequence-direction", "step-number", "step-action"],
    regions: {
      sequence: { x: 0.72, y: 2.0, w: 11.9, h: 3.85 },
      takeaway: { x: 0.82, y: 6.0, w: 11.7, h: 0.62 },
    },
    density: { preferred: "moderate", maxCharacters: 1500, maxItems: 6 },
    imagePolicy: "avoid", minimumBodyFontPt: 16,
    fallbacks: ["worked-example-steps", "activity-brief"], variants: ["horizontal-four-step", "two-row-sequence"],
  },
  "comparison-matrix": {
    id: "comparison-matrix", version: 1, label: "Comparison matrix",
    supportedPurposes: ["comparison", "concept-explanation"],
    supportedBlocks: [...commonText, "comparison"],
    hierarchy: ["shared-criteria", "compared-items", "evidence-per-cell"],
    regions: {
      matrix: { x: 0.72, y: 1.68, w: 11.92, h: 4.98 },
    },
    density: { preferred: "moderate", maxCharacters: 1750, maxItems: 12 },
    imagePolicy: "avoid", minimumBodyFontPt: 15,
    fallbacks: [], variants: ["two-item-contrast", "three-way-comparison"],
  },
  "objective-checklist": {
    id: "objective-checklist", version: 1, label: "Learning checklist",
    supportedPurposes: ["learning-objectives", "learning-outcomes", "success-criteria"],
    supportedBlocks: [...commonText, "orderedSteps"],
    hierarchy: ["outcome-verbs", "student-readable-checks", "success-evidence"],
    regions: {
      list: { x: 1.08, y: 1.72, w: 11.35, h: 4.95 },
      rail: { x: 0.7, y: 1.85, w: 0.12, h: 4.6 },
    },
    density: { preferred: "moderate", maxCharacters: 1650, maxItems: 8 },
    imagePolicy: "avoid", minimumBodyFontPt: 16,
    fallbacks: ["retrieval-practice"], variants: ["learning-targets", "self-check"],
  },
  "activity-brief": {
    id: "activity-brief", version: 1, label: "Classroom activity",
    supportedPurposes: ["classroom-activity", "differentiation", "extended-task"],
    supportedBlocks: [...commonText, "orderedSteps", "task"],
    hierarchy: ["task-outcome", "materials-and-time", "action-sequence"],
    regions: {
      task: { x: 0.78, y: 1.7, w: 7.25, h: 4.95 },
      logistics: { x: 8.48, y: 1.78, w: 4.02, h: 1.85 },
      image: { x: 8.48, y: 3.98, w: 4.02, h: 2.42 },
    },
    density: { preferred: "moderate", maxCharacters: 1650, maxItems: 9 },
    imagePolicy: "optional", minimumBodyFontPt: 16,
    fallbacks: ["process-flow", "objective-checklist"], variants: ["task-with-logistics", "collaborative-challenge"],
  },
  "hinge-question": {
    id: "hinge-question", version: 1, label: "Formative check",
    supportedPurposes: ["formative-assessment", "plenary"],
    supportedBlocks: [...commonText, "question"],
    hierarchy: ["diagnostic-prompt", "answer-choices", "teacher-feedback-cue"],
    regions: {
      prompt: { x: 0.82, y: 1.7, w: 5.0, h: 4.85 },
      choices: { x: 6.28, y: 1.7, w: 6.1, h: 4.85 },
    },
    density: { preferred: "light", maxCharacters: 1050, maxItems: 6 },
    imagePolicy: "avoid", minimumBodyFontPt: 17,
    fallbacks: ["retrieval-practice"], variants: ["multiple-choice", "think-and-vote"],
  },
  "retrieval-practice": {
    id: "retrieval-practice", version: 1, label: "Retrieval practice",
    supportedPurposes: ["plenary", "summary", "learning-outcomes"],
    supportedBlocks: [...commonText, "orderedSteps", "question", "reflection"],
    hierarchy: ["recall-cue", "student-response-space", "central-takeaway"],
    regions: {
      prompts: { x: 0.86, y: 1.72, w: 11.62, h: 4.78 },
    },
    density: { preferred: "light", maxCharacters: 1250, maxItems: 6 },
    imagePolicy: "avoid", minimumBodyFontPt: 17,
    fallbacks: ["reflection-prompt", "objective-checklist"], variants: ["three-recall-cues", "summary-and-check"],
  },
  "reflection-prompt": {
    id: "reflection-prompt", version: 1, label: "Reflection",
    supportedPurposes: ["reflection", "summary", "formative-assessment"],
    supportedBlocks: [...commonText, "reflection", "question"],
    hierarchy: ["reflective-question", "sentence-stems", "next-step"],
    regions: {
      focus: { x: 1.18, y: 1.82, w: 10.98, h: 2.0 },
      stems: { x: 1.52, y: 4.22, w: 10.3, h: 1.72 },
    },
    density: { preferred: "light", maxCharacters: 1000, maxItems: 6 },
    imagePolicy: "avoid", minimumBodyFontPt: 17,
    fallbacks: ["retrieval-practice"], variants: ["single-deep-question", "sentence-starters"],
  },
  "summary-map": {
    id: "summary-map", version: 1, label: "Summary map",
    supportedPurposes: ["summary", "concept-explanation"],
    supportedBlocks: [...commonText, "diagram", "orderedSteps"],
    hierarchy: ["central-concept", "connected-ideas", "relationship-labels"],
    regions: {
      map: { x: 0.9, y: 1.68, w: 11.55, h: 4.95 },
    },
    density: { preferred: "moderate", maxCharacters: 1350, maxItems: 8 },
    imagePolicy: "avoid", minimumBodyFontPt: 15,
    fallbacks: ["concept-focus"], variants: ["radial-summary", "branching-map"],
  },
};

export function getCompositionDefinition(id: EducationalCompositionId): EducationalCompositionDefinition {
  return SLIDE_COMPOSITION_REGISTRY[id];
}

export function blockText(block: EducationalContentBlock): string[] {
  switch (block.type) {
    case "paragraph":
    case "keyIdea": return [block.text];
    case "bulletList":
    case "orderedSteps": return block.items;
    case "workedExample": return [block.prompt, ...block.steps.flatMap((step) => [step.work, ...(step.reasoning ? [step.reasoning] : [])]), block.result];
    case "diagram": return [...block.nodes.map((node) => node.label), ...block.connections.flatMap((edge) => edge.label ? [edge.label] : [])];
    case "comparison": return [...block.criteria, ...block.items.flatMap((item) => [item.label, ...item.values])];
    case "task": return [...block.instructions, ...(block.materials ?? [])];
    case "question": return [block.prompt, ...(block.options ?? []).map((option) => option.text)];
    case "reflection": return [...block.prompts, ...(block.sentenceStarters ?? [])];
  }
}
