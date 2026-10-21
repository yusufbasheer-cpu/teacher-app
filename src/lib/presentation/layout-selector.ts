import {
  getRegisteredLayout,
  getRegisteredLayoutsForSlideType,
  type LayoutFamily,
  type LayoutId,
  type LearningObjectiveRegistryEntry,
  type StarterRegistryEntry,
  type TitleRegistryEntry,
  getLearningObjectiveFitFailures,
  getStarterFitFailures,
  getTitleFitFailures,
} from "@/lib/presentation/layout-registry";
import type { LearningObjectiveContent } from "@/lib/ppt-layouts/learning-objective-layout";
import type { StarterLayoutContent, TitleLayoutContent } from "@/lib/ppt-layouts/title-starter-provisional";

export type LayoutSelection<TLayout> =
  | { kind: "registered"; layout: TLayout; eligibleLayoutIds: LayoutId[] }
  | { kind: "legacy"; reason: "feature-disabled" | "requested-layout-incompatible" | "no-compatible-layout"; eligibleLayoutIds: LayoutId[]; validationFailures?: Record<string, string[]> };

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

/** Small stable hash used only for deterministic layout selection, never security. */
export function deterministicLayoutHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function selectRegisteredLayout(input: {
  enabled: boolean;
  lessonId: string;
  slideId: string;
  slideType: "learning-objective";
  content: LearningObjectiveContent;
  previousFamily?: LayoutFamily | null;
  requestedLayoutId?: LayoutId;
}): LayoutSelection<LearningObjectiveRegistryEntry> {
  if (!input.enabled) return { kind: "legacy", reason: "feature-disabled", eligibleLayoutIds: [] };

  const candidates = getRegisteredLayoutsForSlideType(input.slideType);
  const validationFailures = Object.fromEntries(candidates.map((layout) => [
    layout.id,
    getLearningObjectiveFitFailures(layout, input.content).map((issue) => `${issue.code}:${issue.slot}`),
  ]));
  const compatible = candidates
    .filter((layout) => layout.fits(input.content))
    .sort((left, right) => left.id.localeCompare(right.id));
  const eligibleLayoutIds = compatible.map((layout) => layout.id);

  if (input.requestedLayoutId) {
    const requested = getRegisteredLayout(input.requestedLayoutId) as LearningObjectiveRegistryEntry | null;
    if (requested && requested.slideType === input.slideType && requested.fits(input.content)) {
      return { kind: "registered", layout: requested, eligibleLayoutIds };
    }
    return { kind: "legacy", reason: "requested-layout-incompatible", eligibleLayoutIds, validationFailures };
  }
  if (compatible.length === 0) return { kind: "legacy", reason: "no-compatible-layout", eligibleLayoutIds, validationFailures };

  const varied = input.previousFamily && compatible.some((layout) => layout.family !== input.previousFamily)
    ? compatible.filter((layout) => layout.family !== input.previousFamily)
    : compatible;
  const seed = `${input.lessonId}|${input.slideId}|${input.slideType}|${canonicalize(input.content)}|${varied.map((layout) => layout.id).join(",")}`;
  return { kind: "registered", layout: varied[deterministicLayoutHash(seed) % varied.length]!, eligibleLayoutIds };
}

export function selectLearningObjectiveLayout(input: {
  enabled: boolean;
  lessonId: string;
  slideId: string;
  content: LearningObjectiveContent;
  previousFamily?: LayoutFamily | null;
  requestedLayoutId?: LayoutId;
}): LayoutSelection<LearningObjectiveRegistryEntry> {
  return selectRegisteredLayout({ ...input, slideType: "learning-objective" });
}

function selectPhase4ALayout<TContent, TLayout extends { id: LayoutId; family: LayoutFamily; fits: (content: TContent) => boolean }>(input: {
  enabled: boolean;
  lessonId: string;
  slideId: string;
  slideType: "title" | "starter";
  content: TContent;
  layouts: readonly TLayout[];
  fitFailures: (layout: TLayout, content: TContent) => string[];
  requestedLayoutId?: LayoutId;
  previousFamily?: LayoutFamily | null;
}): LayoutSelection<TLayout> {
  if (!input.enabled) return { kind: "legacy", reason: "feature-disabled", eligibleLayoutIds: [] };
  const validationFailures = Object.fromEntries(input.layouts.map((layout) => [layout.id, input.fitFailures(layout, input.content)]));
  const compatible = input.layouts.filter((layout) => layout.fits(input.content)).sort((left, right) => left.id.localeCompare(right.id));
  const eligibleLayoutIds = compatible.map((layout) => layout.id);
  if (input.requestedLayoutId) {
    const requested = compatible.find((layout) => layout.id === input.requestedLayoutId);
    return requested
      ? { kind: "registered", layout: requested, eligibleLayoutIds }
      : { kind: "legacy", reason: "requested-layout-incompatible", eligibleLayoutIds, validationFailures };
  }
  if (compatible.length === 0) return { kind: "legacy", reason: "no-compatible-layout", eligibleLayoutIds, validationFailures };
  const varied = input.previousFamily && compatible.some((layout) => layout.family !== input.previousFamily)
    ? compatible.filter((layout) => layout.family !== input.previousFamily)
    : compatible;
  const seed = `${input.lessonId}|${input.slideId}|${input.slideType}|${canonicalize(input.content)}|${varied.map((layout) => layout.id).join(",")}`;
  return { kind: "registered", layout: varied[deterministicLayoutHash(seed) % varied.length]!, eligibleLayoutIds };
}

export function selectTitleLayout(input: {
  enabled: boolean;
  lessonId: string;
  slideId: string;
  content: TitleLayoutContent;
  previousFamily?: LayoutFamily | null;
  requestedLayoutId?: LayoutId;
}): LayoutSelection<TitleRegistryEntry> {
  const registered = getRegisteredLayoutsForSlideType("title");
  const preferred = input.content.hasImage
    ? registered.filter((layout) => layout.family === "hero")
    : registered.filter((layout) => layout.family === "typography");
  return selectPhase4ALayout({
    ...input,
    slideType: "title",
    layouts: input.requestedLayoutId ? registered : preferred,
    fitFailures: getTitleFitFailures,
  });
}

export function selectStarterLayout(input: {
  enabled: boolean;
  lessonId: string;
  slideId: string;
  content: StarterLayoutContent;
  previousFamily?: LayoutFamily | null;
  requestedLayoutId?: LayoutId;
}): LayoutSelection<StarterRegistryEntry> {
  const registered = getRegisteredLayoutsForSlideType("starter");
  const wantsVisualPrompt = input.content.activityKind === "picture-prompt" && input.content.hasImage;
  const preferred = registered.filter((layout) => layout.family === (wantsVisualPrompt ? "visual-prompt" : "activity-brief"));
  return selectPhase4ALayout({
    ...input,
    slideType: "starter",
    layouts: input.requestedLayoutId ? registered : preferred,
    fitFailures: getStarterFitFailures,
  });
}
