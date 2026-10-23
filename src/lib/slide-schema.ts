import { AFL_PHASE_GROUPS, AFL_PHASE_IDS, type AflPhaseId } from "@/lib/afl-tools";
import {
  isPresentationLanguage,
  isRtlLanguage,
  type PresentationLanguage,
} from "@/lib/ppt-language";

export const DECK_SCHEMA_VERSION = 1 as const;
export const MAX_DECK_SLIDES = 100;
export const MAX_DECK_TEXT_CHARACTERS = 250_000;
export const MAX_DECK_VALUE_NODES = 200_000;

/** Bounded educational compositions understood by future preview/export renderers. */
export const EDUCATIONAL_COMPOSITION_IDS = [
  "concept-focus",
  "definition-and-example",
  "worked-example-steps",
  "labeled-diagram",
  "process-flow",
  "comparison-matrix",
  "objective-checklist",
  "activity-brief",
  "hinge-question",
  "retrieval-practice",
  "summary-map",
  "reflection-prompt",
] as const;

export type EducationalCompositionId = (typeof EDUCATIONAL_COMPOSITION_IDS)[number];

export const PEDAGOGICAL_PURPOSES = [
  "opening",
  "context",
  "learning-objectives",
  "learning-outcomes",
  "concept-explanation",
  "worked-example",
  "diagram",
  "process",
  "comparison",
  "classroom-activity",
  "differentiation",
  "plenary",
  "formative-assessment",
  "success-criteria",
  "extended-task",
  "summary",
  "reflection",
  "connection",
] as const;

export type PedagogicalPurpose = (typeof PEDAGOGICAL_PURPOSES)[number];

export type ParagraphBlock = { type: "paragraph"; text: string };
export type KeyIdeaBlock = { type: "keyIdea"; text: string; label?: string };
export type BulletListBlock = { type: "bulletList"; items: string[] };
export type OrderedStepsBlock = { type: "orderedSteps"; items: string[] };
export type WorkedExampleBlock = {
  type: "workedExample";
  prompt: string;
  steps: { work: string; reasoning?: string }[];
  result: string;
};
export type DiagramBlock = {
  type: "diagram";
  nodes: { id: string; label: string; kind?: string }[];
  connections: { from: string; to: string; label?: string }[];
};
export type ComparisonBlock = {
  type: "comparison";
  criteria: string[];
  items: { label: string; values: string[] }[];
};
export type TaskBlock = {
  type: "task";
  instructions: string[];
  materials?: string[];
  timeMinutes?: number;
};
export type QuestionBlock = {
  type: "question";
  prompt: string;
  options?: { id: string; text: string }[];
  correctOptionIds?: string[];
};
export type ReflectionBlock = {
  type: "reflection";
  prompts: string[];
  sentenceStarters?: string[];
};

export type EducationalContentBlock =
  | ParagraphBlock
  | KeyIdeaBlock
  | BulletListBlock
  | OrderedStepsBlock
  | WorkedExampleBlock
  | DiagramBlock
  | ComparisonBlock
  | TaskBlock
  | QuestionBlock
  | ReflectionBlock;

export type SlideImageSpec = {
  /** Existing image URL or a concise image-generation/search brief. */
  url?: string;
  brief?: string;
  altText?: string;
  fit?: "cover" | "contain";
  focalPoint?: { x: number; y: number };
};

export type SlideAflMetadata = {
  phase: AflPhaseId;
  selectedToolIds: string[];
  provenance: "teacher-selected";
  /** Retains a legacy callout if a future caller has one as structured metadata. */
  callout?: string;
};

export type SlideLayoutIntent = {
  density?: "light" | "moderate" | "dense";
  emphasis?: "concept" | "evidence" | "procedure" | "practice" | "reflection";
  image?: "avoid" | "optional" | "required";
};

export type SlideSpec = {
  id: string;
  order: number;
  title: string;
  pedagogicalPurpose: PedagogicalPurpose;
  /** Null means the legacy source did not state a separate takeaway. */
  centralTakeaway: string | null;
  contentBlocks: EducationalContentBlock[];
  layoutIntent: SlideLayoutIntent;
  composition?: EducationalCompositionId;
  /** Deterministic registry variant selected for this composition, if one applies. */
  compositionVariant?: string;
  image?: SlideImageSpec;
  afl?: SlideAflMetadata;
  speakerNotes: string;
};

export type DeckSpec = {
  id: string;
  schemaVersion: typeof DECK_SCHEMA_VERSION;
  subject: string;
  grade: string;
  topic?: string;
  language: PresentationLanguage;
  textDirection: "ltr" | "rtl";
  /** Theme IDs include built-in themes and `custom` school-template themes. */
  theme: { id: string };
  slides: SlideSpec[];
};

export type DeckValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type DeckValidationResult =
  | { ok: true; value: DeckSpec }
  | { ok: false; issues: DeckValidationIssue[] };

const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const compositionSet = new Set<string>(EDUCATIONAL_COMPOSITION_IDS);
const purposeSet = new Set<string>(PEDAGOGICAL_PURPOSES);
const aflPhaseSet = new Set<string>(AFL_PHASE_IDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  issues: DeckValidationIssue[],
  path: string,
  code: string,
  message: string,
): void {
  issues.push({ path, code, message });
}

/** Bound untrusted deck payloads before schema validation walks nested blocks. */
function validateDeckPayloadBounds(value: Record<string, unknown>, issues: DeckValidationIssue[]): boolean {
  if (Array.isArray(value.slides) && value.slides.length > MAX_DECK_SLIDES) {
    issue(issues, "slides", "too_many_slides", `A deck can contain at most ${MAX_DECK_SLIDES} logical slides.`);
    return false;
  }

  const stack: unknown[] = [value];
  let visitedNodes = 0;
  let textCharacters = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    visitedNodes += 1;
    if (visitedNodes > MAX_DECK_VALUE_NODES) {
      issue(issues, "$", "deck_too_complex", `A deck can contain at most ${MAX_DECK_VALUE_NODES} values.`);
      return false;
    }
    if (typeof current === "string") {
      textCharacters += current.length;
      if (textCharacters > MAX_DECK_TEXT_CHARACTERS) {
        issue(issues, "$", "deck_text_too_large", `Deck text cannot exceed ${MAX_DECK_TEXT_CHARACTERS} characters.`);
        return false;
      }
      continue;
    }
    if (typeof current !== "object" || current === null) continue;
    const children = Array.isArray(current) ? current : Object.values(current);
    if (children.length > MAX_DECK_VALUE_NODES - visitedNodes || stack.length + children.length > MAX_DECK_VALUE_NODES) {
      issue(issues, "$", "deck_too_complex", `A deck can contain at most ${MAX_DECK_VALUE_NODES} values.`);
      return false;
    }
    for (const child of children) stack.push(child);
  }
  return true;
}

function nonEmptyString(
  value: unknown,
  path: string,
  issues: DeckValidationIssue[],
): value is string {
  if (typeof value !== "string" || !value.trim()) {
    issue(issues, path, "required_string", "Expected a non-empty string.");
    return false;
  }
  return true;
}

function validateStringArray(
  value: unknown,
  path: string,
  issues: DeckValidationIssue[],
  minimum = 1,
): value is string[] {
  if (!Array.isArray(value)) {
    issue(issues, path, "expected_array", "Expected an array of strings.");
    return false;
  }
  if (value.length < minimum) {
    issue(issues, path, "too_few_items", `Expected at least ${minimum} item(s).`);
  }
  value.forEach((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      issue(issues, `${path}[${index}]`, "required_string", "Expected a non-empty string.");
    }
  });
  return true;
}

function validateDiagramBlock(
  block: Record<string, unknown>,
  path: string,
  issues: DeckValidationIssue[],
): void {
  if (!Array.isArray(block.nodes) || block.nodes.length === 0) {
    issue(issues, `${path}.nodes`, "required_array", "A diagram needs at least one node.");
    return;
  }
  const nodeIds = new Set<string>();
  block.nodes.forEach((rawNode, index) => {
    const nodePath = `${path}.nodes[${index}]`;
    if (!isRecord(rawNode)) {
      issue(issues, nodePath, "expected_object", "Expected a diagram node object.");
      return;
    }
    if (nonEmptyString(rawNode.id, `${nodePath}.id`, issues)) {
      if (!stableIdPattern.test(rawNode.id)) {
        issue(issues, `${nodePath}.id`, "invalid_id", "Node IDs must be stable identifier strings.");
      }
      if (nodeIds.has(rawNode.id)) {
        issue(issues, `${nodePath}.id`, "duplicate_id", "Diagram node IDs must be unique.");
      }
      nodeIds.add(rawNode.id);
    }
    nonEmptyString(rawNode.label, `${nodePath}.label`, issues);
    if (rawNode.kind !== undefined) nonEmptyString(rawNode.kind, `${nodePath}.kind`, issues);
  });
  if (!Array.isArray(block.connections)) {
    issue(issues, `${path}.connections`, "expected_array", "Expected an array of diagram connections.");
    return;
  }
  block.connections.forEach((rawConnection, index) => {
    const connectionPath = `${path}.connections[${index}]`;
    if (!isRecord(rawConnection)) {
      issue(issues, connectionPath, "expected_object", "Expected a diagram connection object.");
      return;
    }
    const fromOk = nonEmptyString(rawConnection.from, `${connectionPath}.from`, issues);
    const toOk = nonEmptyString(rawConnection.to, `${connectionPath}.to`, issues);
    if (fromOk && typeof rawConnection.from === "string" && !nodeIds.has(rawConnection.from)) {
      issue(issues, `${connectionPath}.from`, "unknown_diagram_node", "Connection source must reference a diagram node.");
    }
    if (toOk && typeof rawConnection.to === "string" && !nodeIds.has(rawConnection.to)) {
      issue(issues, `${connectionPath}.to`, "unknown_diagram_node", "Connection target must reference a diagram node.");
    }
    if (rawConnection.label !== undefined) {
      nonEmptyString(rawConnection.label, `${connectionPath}.label`, issues);
    }
  });
}

function validateContentBlock(value: unknown, path: string, issues: DeckValidationIssue[]): void {
  if (!isRecord(value)) {
    issue(issues, path, "expected_object", "Expected a content block object.");
    return;
  }
  if (typeof value.type !== "string") {
    issue(issues, `${path}.type`, "required_string", "Content blocks need a type discriminator.");
    return;
  }
  switch (value.type) {
    case "paragraph":
    case "keyIdea":
      nonEmptyString(value.text, `${path}.text`, issues);
      if (value.type === "keyIdea" && value.label !== undefined) {
        nonEmptyString(value.label, `${path}.label`, issues);
      }
      break;
    case "bulletList":
    case "orderedSteps":
      validateStringArray(value.items, `${path}.items`, issues);
      break;
    case "workedExample":
      nonEmptyString(value.prompt, `${path}.prompt`, issues);
      nonEmptyString(value.result, `${path}.result`, issues);
      if (!Array.isArray(value.steps) || value.steps.length === 0) {
        issue(issues, `${path}.steps`, "required_array", "A worked example needs at least one reasoning step.");
      } else {
        value.steps.forEach((step, index) => {
          const stepPath = `${path}.steps[${index}]`;
          if (!isRecord(step)) {
            issue(issues, stepPath, "expected_object", "Expected a worked-example step.");
            return;
          }
          nonEmptyString(step.work, `${stepPath}.work`, issues);
          if (step.reasoning !== undefined) nonEmptyString(step.reasoning, `${stepPath}.reasoning`, issues);
        });
      }
      break;
    case "diagram":
      validateDiagramBlock(value, path, issues);
      break;
    case "comparison":
      validateStringArray(value.criteria, `${path}.criteria`, issues);
      if (!Array.isArray(value.items) || value.items.length < 2) {
        issue(issues, `${path}.items`, "too_few_items", "A comparison needs at least two items.");
      } else {
        value.items.forEach((item, index) => {
          const itemPath = `${path}.items[${index}]`;
          if (!isRecord(item)) {
            issue(issues, itemPath, "expected_object", "Expected a comparison item.");
            return;
          }
          nonEmptyString(item.label, `${itemPath}.label`, issues);
          if (Array.isArray(value.criteria) && Array.isArray(item.values) && item.values.length !== value.criteria.length) {
            issue(issues, `${itemPath}.values`, "criteria_value_count", "Each comparison item needs one value per criterion.");
          }
          validateStringArray(item.values, `${itemPath}.values`, issues);
        });
      }
      break;
    case "task":
      validateStringArray(value.instructions, `${path}.instructions`, issues);
      if (value.materials !== undefined) validateStringArray(value.materials, `${path}.materials`, issues, 0);
      if (value.timeMinutes !== undefined && (!Number.isInteger(value.timeMinutes) || (value.timeMinutes as number) <= 0)) {
        issue(issues, `${path}.timeMinutes`, "invalid_number", "Task time must be a positive whole number of minutes.");
      }
      break;
    case "question": {
      nonEmptyString(value.prompt, `${path}.prompt`, issues);
      const optionIds = new Set<string>();
      if (value.options !== undefined) {
        if (!Array.isArray(value.options) || value.options.length < 2) {
          issue(issues, `${path}.options`, "too_few_options", "If supplied, answer choices need at least two options.");
        } else {
          value.options.forEach((option, index) => {
            const optionPath = `${path}.options[${index}]`;
            if (!isRecord(option)) {
              issue(issues, optionPath, "expected_object", "Expected an answer choice object.");
              return;
            }
            const idOk = nonEmptyString(option.id, `${optionPath}.id`, issues);
            nonEmptyString(option.text, `${optionPath}.text`, issues);
            if (idOk && typeof option.id === "string") {
              if (!stableIdPattern.test(option.id)) issue(issues, `${optionPath}.id`, "invalid_id", "Option IDs must be stable identifier strings.");
              if (optionIds.has(option.id)) issue(issues, `${optionPath}.id`, "duplicate_id", "Answer choice IDs must be unique.");
              optionIds.add(option.id);
            }
          });
        }
      }
      if (value.correctOptionIds !== undefined) {
        validateStringArray(value.correctOptionIds, `${path}.correctOptionIds`, issues);
        if (Array.isArray(value.correctOptionIds)) {
          value.correctOptionIds.forEach((id, index) => {
            if (typeof id === "string" && !optionIds.has(id)) {
              issue(issues, `${path}.correctOptionIds[${index}]`, "unknown_option", "Correct answers must reference supplied options.");
            }
          });
        }
      }
      break;
    }
    case "reflection":
      validateStringArray(value.prompts, `${path}.prompts`, issues);
      if (value.sentenceStarters !== undefined) validateStringArray(value.sentenceStarters, `${path}.sentenceStarters`, issues);
      break;
    default:
      issue(issues, `${path}.type`, "unknown_block_type", `Unsupported educational content block type: ${value.type}.`);
  }
}

function validateImage(value: unknown, path: string, issues: DeckValidationIssue[]): void {
  if (!isRecord(value)) {
    issue(issues, path, "expected_object", "Expected image metadata.");
    return;
  }
  let hasSource = false;
  if (value.url !== undefined) {
    if (nonEmptyString(value.url, `${path}.url`, issues)) {
      hasSource = true;
      try {
        const parsed = new URL(value.url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          issue(issues, `${path}.url`, "invalid_url", "Image URLs must use HTTP or HTTPS.");
        }
      } catch {
        issue(issues, `${path}.url`, "invalid_url", "Expected an absolute HTTP or HTTPS image URL.");
      }
    }
  }
  if (value.brief !== undefined && nonEmptyString(value.brief, `${path}.brief`, issues)) hasSource = true;
  if (!hasSource) issue(issues, path, "missing_image_source", "Image metadata needs a URL or a brief.");
  if (value.altText !== undefined && typeof value.altText !== "string") {
    issue(issues, `${path}.altText`, "expected_string", "Alt text must be a string.");
  }
  if (value.fit !== undefined && value.fit !== "cover" && value.fit !== "contain") {
    issue(issues, `${path}.fit`, "invalid_enum", "Image fit must be cover or contain.");
  }
  if (value.focalPoint !== undefined) {
    if (!isRecord(value.focalPoint)) {
      issue(issues, `${path}.focalPoint`, "expected_object", "Expected a focal-point object.");
    } else {
      for (const axis of ["x", "y"] as const) {
        const coordinate = value.focalPoint[axis];
        if (typeof coordinate !== "number" || coordinate < 0 || coordinate > 1) {
          issue(issues, `${path}.focalPoint.${axis}`, "invalid_coordinate", "Focal-point coordinates must be between 0 and 1.");
        }
      }
    }
  }
}

function validateAfl(value: unknown, path: string, issues: DeckValidationIssue[]): void {
  if (!isRecord(value)) {
    issue(issues, path, "expected_object", "Expected AFL metadata.");
    return;
  }
  if (typeof value.phase !== "string" || !aflPhaseSet.has(value.phase)) {
    issue(issues, `${path}.phase`, "invalid_afl_phase", "AFL phase is not supported.");
    return;
  }
  if (value.provenance !== "teacher-selected") {
    issue(issues, `${path}.provenance`, "invalid_afl_provenance", "AFL metadata must identify teacher-selected tools.");
  }
  if (value.callout !== undefined && typeof value.callout !== "string") {
    issue(issues, `${path}.callout`, "expected_string", "AFL callout must be a string.");
  }
  if (!Array.isArray(value.selectedToolIds) || value.selectedToolIds.length === 0) {
    issue(issues, `${path}.selectedToolIds`, "required_array", "AFL metadata needs at least one selected tool ID.");
    return;
  }
  const phaseGroup = AFL_PHASE_GROUPS.find((group) => group.phase === value.phase);
  const allowedIds = new Set(phaseGroup?.tools.map((tool) => tool.id) ?? []);
  const seen = new Set<string>();
  value.selectedToolIds.forEach((id, index) => {
    if (typeof id !== "string" || !id.trim()) {
      issue(issues, `${path}.selectedToolIds[${index}]`, "required_string", "Expected a non-empty AFL tool ID.");
    } else if (!allowedIds.has(id)) {
      issue(issues, `${path}.selectedToolIds[${index}]`, "unknown_afl_tool", "AFL tool ID must belong to the selected phase.");
    } else if (seen.has(id)) {
      issue(issues, `${path}.selectedToolIds[${index}]`, "duplicate_id", "AFL tool IDs must be unique.");
    }
    if (typeof id === "string") seen.add(id);
  });
}

/** Validate untrusted JSON before any preview or export code consumes it. */
export function parseDeckSpec(value: unknown): DeckValidationResult {
  const issues: DeckValidationIssue[] = [];
  if (!isRecord(value)) {
    return { ok: false, issues: [{ path: "$", code: "expected_object", message: "Expected a deck object." }] };
  }
  if (!validateDeckPayloadBounds(value, issues)) return { ok: false, issues };

  if (value.schemaVersion !== DECK_SCHEMA_VERSION) {
    issue(issues, "schemaVersion", "unsupported_schema_version", `Only schema version ${DECK_SCHEMA_VERSION} is supported.`);
  }
  if (nonEmptyString(value.id, "id", issues) && !stableIdPattern.test(value.id)) {
    issue(issues, "id", "invalid_id", "Deck IDs must be stable identifier strings.");
  }
  nonEmptyString(value.subject, "subject", issues);
  nonEmptyString(value.grade, "grade", issues);
  if (value.topic !== undefined && typeof value.topic !== "string") {
    issue(issues, "topic", "expected_string", "Topic must be a string when supplied.");
  }
  if (!isPresentationLanguage(value.language)) {
    issue(issues, "language", "invalid_language", "Language must be a supported Layah presentation language.");
  } else {
    const expectedDirection = isRtlLanguage(value.language) ? "rtl" : "ltr";
    if (value.textDirection !== expectedDirection) {
      issue(issues, "textDirection", "language_direction_mismatch", `Language ${value.language} requires ${expectedDirection} text direction.`);
    }
  }
  if (value.textDirection !== "ltr" && value.textDirection !== "rtl") {
    issue(issues, "textDirection", "invalid_direction", "Text direction must be ltr or rtl.");
  }
  if (!isRecord(value.theme)) {
    issue(issues, "theme", "expected_object", "Expected a presentation theme object.");
  } else {
    nonEmptyString(value.theme.id, "theme.id", issues);
  }

  if (!Array.isArray(value.slides) || value.slides.length === 0) {
    issue(issues, "slides", "required_array", "A deck must contain at least one slide.");
  } else {
    const slideIds = new Set<string>();
    const slideOrders = new Set<number>();
    let previousOrder = -1;
    value.slides.forEach((rawSlide, index) => {
      const path = `slides[${index}]`;
      if (!isRecord(rawSlide)) {
        issue(issues, path, "expected_object", "Expected a slide object.");
        return;
      }
      if (nonEmptyString(rawSlide.id, `${path}.id`, issues)) {
        if (!stableIdPattern.test(rawSlide.id)) issue(issues, `${path}.id`, "invalid_id", "Slide IDs must be stable identifier strings.");
        if (slideIds.has(rawSlide.id)) issue(issues, `${path}.id`, "duplicate_id", "Slide IDs must be unique within a deck.");
        slideIds.add(rawSlide.id);
      }
      if (!Number.isInteger(rawSlide.order) || (rawSlide.order as number) < 0) {
        issue(issues, `${path}.order`, "invalid_order", "Slide order must be a non-negative whole number.");
      } else {
        const order = rawSlide.order as number;
        if (slideOrders.has(order)) issue(issues, `${path}.order`, "duplicate_order", "Slide order values must be unique.");
        if (order <= previousOrder) issue(issues, `${path}.order`, "unordered_slides", "Slides must appear in ascending order.");
        previousOrder = order;
        slideOrders.add(order);
      }
      nonEmptyString(rawSlide.title, `${path}.title`, issues);
      if (typeof rawSlide.pedagogicalPurpose !== "string" || !purposeSet.has(rawSlide.pedagogicalPurpose)) {
        issue(issues, `${path}.pedagogicalPurpose`, "invalid_purpose", "Pedagogical purpose is not supported.");
      }
      if (rawSlide.centralTakeaway !== null && (typeof rawSlide.centralTakeaway !== "string" || !rawSlide.centralTakeaway.trim())) {
        issue(issues, `${path}.centralTakeaway`, "invalid_takeaway", "Central takeaway must be null or a non-empty string.");
      }
      if (!Array.isArray(rawSlide.contentBlocks) || rawSlide.contentBlocks.length === 0) {
        issue(issues, `${path}.contentBlocks`, "required_array", "A slide must contain at least one structured content block.");
      } else {
        rawSlide.contentBlocks.forEach((block, blockIndex) => validateContentBlock(block, `${path}.contentBlocks[${blockIndex}]`, issues));
      }
      if (!isRecord(rawSlide.layoutIntent)) {
        issue(issues, `${path}.layoutIntent`, "expected_object", "Expected a layout-intent object.");
      } else {
        const validEnums: Record<string, readonly string[]> = {
          density: ["light", "moderate", "dense"],
          emphasis: ["concept", "evidence", "procedure", "practice", "reflection"],
          image: ["avoid", "optional", "required"],
        };
        for (const [key, allowed] of Object.entries(validEnums)) {
          const selected = rawSlide.layoutIntent[key];
          if (selected !== undefined && (typeof selected !== "string" || !allowed.includes(selected))) {
            issue(issues, `${path}.layoutIntent.${key}`, "invalid_enum", `Unsupported layout intent ${key}.`);
          }
        }
      }
      if (rawSlide.composition !== undefined && (typeof rawSlide.composition !== "string" || !compositionSet.has(rawSlide.composition))) {
        issue(issues, `${path}.composition`, "invalid_composition", "Composition identifier is not in the educational composition registry.");
      }
      if (rawSlide.compositionVariant !== undefined && (typeof rawSlide.compositionVariant !== "string" || !rawSlide.compositionVariant.trim())) {
        issue(issues, `${path}.compositionVariant`, "invalid_composition_variant", "Composition variant must be a non-empty string.");
      }
      if (rawSlide.image !== undefined) validateImage(rawSlide.image, `${path}.image`, issues);
      if (rawSlide.afl !== undefined) validateAfl(rawSlide.afl, `${path}.afl`, issues);
      if (typeof rawSlide.speakerNotes !== "string") {
        issue(issues, `${path}.speakerNotes`, "expected_string", "Speaker notes must be a string (use an empty string when there are none).");
      }
    });
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: value as unknown as DeckSpec };
}

export function isDeckSpec(value: unknown): value is DeckSpec {
  return parseDeckSpec(value).ok;
}

