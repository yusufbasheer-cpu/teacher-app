import {
  getRegisteredLayout,
  getRegisteredLayoutsForSlideType,
  type LayoutFamily,
  type LayoutId,
  type LearningObjectiveRegistryEntry,
  type DesignLibrarySlideType,
} from "@/lib/presentation/layout-registry";
import type { LearningObjectiveContent } from "@/lib/ppt-layouts/learning-objective-layout";

export type LayoutSelection<TLayout> =
  | { kind: "registered"; layout: TLayout; eligibleLayoutIds: LayoutId[] }
  | { kind: "legacy"; reason: "feature-disabled" | "requested-layout-incompatible" | "no-compatible-layout"; eligibleLayoutIds: LayoutId[] };

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
  slideType: DesignLibrarySlideType;
  content: LearningObjectiveContent;
  previousFamily?: LayoutFamily | null;
  requestedLayoutId?: LayoutId;
}): LayoutSelection<LearningObjectiveRegistryEntry> {
  if (!input.enabled) return { kind: "legacy", reason: "feature-disabled", eligibleLayoutIds: [] };

  const compatible = getRegisteredLayoutsForSlideType(input.slideType)
    .filter((layout) => layout.fits(input.content))
    .sort((left, right) => left.id.localeCompare(right.id));
  const eligibleLayoutIds = compatible.map((layout) => layout.id);

  if (input.requestedLayoutId) {
    const requested = getRegisteredLayout(input.requestedLayoutId);
    if (requested && requested.slideType === input.slideType && requested.fits(input.content)) {
      return { kind: "registered", layout: requested, eligibleLayoutIds };
    }
    return { kind: "legacy", reason: "requested-layout-incompatible", eligibleLayoutIds };
  }
  if (compatible.length === 0) return { kind: "legacy", reason: "no-compatible-layout", eligibleLayoutIds };

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
