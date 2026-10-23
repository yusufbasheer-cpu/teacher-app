import { slideKindAt } from "@/lib/ppt-template-engine";
import type { GammaLessonMeta } from "./payload";
import {
  REQUIRED_VISUAL_DECK_INDEX,
  type RequiredVisualCategory,
} from "@/lib/ppt-visual-intent";

/** One physical slide of the canonical (platform-paginated) deck. `part` is 1-based within its lesson section. */
export type CanonicalSlide = {
  deckIdx: number;
  part: number;
  parts: number;
  title: string;
  lines: string[];
  physicalKind?: "content" | "activity-instructions";
  activityId?: string;
};

/** Functional role of a slide; decides its layout and whether it may carry a picture. */
export type SlideType = "title" | "concept" | "worked-example" | "activity" | "questions" | "real-life" | "objectives" | "summary";

/** diagram: one concept diagram in a column ≤ 1/3 width · side: one contextual picture ≤ 1/3 · inset: one small picture ≤ 1/4 · none. */
export type ImagePlan = "diagram" | "side" | "inset" | "none";

export type SlideLayoutPlan = {
  slideIndex: number;
  type: SlideType;
  image: ImagePlan;
  reason: string;
  requiredVisualCategory?: RequiredVisualCategory;
};

import { pictureMediumFor, type PictureMedium } from "./picture-medium";
export { pictureMediumFor, type PictureMedium };

/** Text density limits per picture size. ponytail: character counts, not a layout measurement; tune from real decks. */
export const DIAGRAM_MAX_CHARS = 1200;
export const SIDE_IMAGE_MAX_CHARS = 700;
export const INSET_IMAGE_MAX_CHARS = 350;

const WORKED = /(=|÷|×|\bcalculat|\bformula\b|\bsolve\b|\bequation\b)/i;
const charsOf = (s: CanonicalSlide) => s.lines.reduce((n, l) => n + l.length, 0);

export function classifySlide(s: CanonicalSlide): SlideType {
  const kind = slideKindAt(s.deckIdx);
  if (s.deckIdx === 0) return "title";
  if (kind === "hero-close") return "summary";
  if (kind === "checklist") return "objectives";
  const questions = s.lines.filter((l) => l.trim().endsWith("?")).length;
  if (s.deckIdx === 10 || (s.lines.length > 0 && questions / s.lines.length >= 0.5)) return "questions";
  const text = s.lines.join(" ");
  if (WORKED.test(text) && /\d/.test(text)) return "worked-example";
  if (s.deckIdx === 7) return "real-life";
  if (kind === "activity") return "activity";
  return "concept";
}

/** Deck indexes in the 13-section lesson: the core teaching slide, and the decorative chapter/SDG slide. */
const CORE_TEACHING_IDX = 5;

/**
 * Content first, and pictures that teach: the one visual that helps most is a concept diagram on the core teaching
 * slide. No cover art, no decorative chapter/SDG picture; continuation, question, objective, worked-example and
 * summary slides stay text-only, and dense slides lose their picture before any text gets smaller.
 */
export function planSlideLayouts(slides: CanonicalSlide[]): SlideLayoutPlan[] {
  const firstContentByDeck = new Map<number, number>();
  slides.forEach((slide, index) => {
    if (slide.physicalKind !== "activity-instructions" && !firstContentByDeck.has(slide.deckIdx)) {
      firstContentByDeck.set(slide.deckIdx, index);
    }
  });
  const requiredByDeck = new Map<number, RequiredVisualCategory>(
    Object.entries(REQUIRED_VISUAL_DECK_INDEX).map(([category, deckIndex]) => [deckIndex, category as RequiredVisualCategory]),
  );
  return slides.map((s, slideIndex) => {
    const type = classifySlide(s);
    const chars = charsOf(s);
    const requiredVisualCategory = requiredByDeck.get(s.deckIdx);
    const isRequiredPlacement = requiredVisualCategory !== undefined && s.part === 1 && firstContentByDeck.get(s.deckIdx) === slideIndex;
    const plan = (image: ImagePlan, reason: string): SlideLayoutPlan => ({
      slideIndex,
      type,
      image,
      reason,
      ...(isRequiredPlacement ? { requiredVisualCategory } : {}),
    });
    if (s.physicalKind === "activity-instructions") return plan("none", "Student instructions stay text-only and readable.");
    if (isRequiredPlacement) {
      if (requiredVisualCategory === "cover") return plan("side", "Required subject-specific cover visual.");
      if (requiredVisualCategory === "starter") return plan("side", "Required visual supports the starter observation or question.");
      if (requiredVisualCategory === "topic") return plan("diagram", "Required topic overview illustration.");
      if (requiredVisualCategory === "main-phase") return plan("diagram", "Required compact teaching diagram on the first main-phase content card.");
      if (requiredVisualCategory === "uae-connection") return plan("side", "Required visual depicts the actual real-life/UAE connection.");
      if (requiredVisualCategory === "takeaway") return plan("diagram", "Required visual reinforces the central learning takeaway.");
    }
    if (s.part > 1) return plan("none", "Continuation slide: all space goes to the content.");
    if (s.deckIdx === CORE_TEACHING_IDX && chars <= DIAGRAM_MAX_CHARS) return plan("diagram", "Core teaching: a concept diagram explains the idea.");
    if (type === "concept" && chars <= SIDE_IMAGE_MAX_CHARS) return plan("diagram", "A concept diagram supports the explanation.");
    if (type === "real-life" && chars <= SIDE_IMAGE_MAX_CHARS) return plan("side", "One contextual picture supports the application.");
    if (type === "activity" && chars <= INSET_IMAGE_MAX_CHARS) return plan("inset", "Short activity: a small supporting picture fits.");
    return plan("none", type === "concept" || type === "real-life" || type === "activity" ? "Dense slide: the content needs the space." : `${type} slides are text-first.`);
  });
}

const LAYOUT_RULES: Record<SlideType, string> = {
  title: "bold cover",
  concept: "text-first or balanced split, text keeps at least two-thirds of the slide",
  "worked-example": "strictly text-first, every equation, number and step on its own line in order",
  activity: "text-first, numbered steps or side-by-side cards for parallel tasks",
  questions: "text only, each question clearly separated",
  "real-life": "balanced, text keeps at least 60% of the slide",
  objectives: "clean checklist, text only",
  summary: "calm, simple text layout",
};

function pictureNoun(medium: PictureMedium): string {
  if (medium === "photo") return "real photograph";
  if (medium === "realistic") return "photorealistic image";
  return "educational illustration";
}

/** A stock photo cannot be a diagram; every other medium draws one, without text so it cannot invent labels. */
function diagramNoun(medium: PictureMedium): string {
  return medium === "photo" ? "real photograph that shows the idea" : "simple concept diagram with no words or numbers in it";
}

/** Compact per-slide brief (a legend once, then one short line per slide) so 25 slides still fit Gamma's 5000 chars. */
export function layoutInstructionsFor(slides: CanonicalSlide[], plans: SlideLayoutPlan[], medium: PictureMedium, lesson?: GammaLessonMeta): string {
  const noun = pictureNoun(medium);
  const about = lesson?.topic.trim() ? ` (lesson: ${lesson.topic.trim()})` : "";
  const legend = (Object.keys(LAYOUT_RULES) as SlideType[]).map((t) => `${t} = ${LAYOUT_RULES[t]}`).join("; ");
  const lines = plans.map((p) => {
    const image = medium === "none" || p.image === "none"
      ? "no image"
      : p.image === "diagram"
        ? `one ${diagramNoun(medium)} explaining "${slides[p.slideIndex]!.title}", side column, max 1/3 width`
        : p.image === "side"
          ? `one ${noun} of "${slides[p.slideIndex]!.title}" in a side column, max 1/3 width`
          : `one small ${noun} of "${slides[p.slideIndex]!.title}", max 1/4 of the slide`;
    const required = p.requiredVisualCategory ? ` REQUIRED ${p.requiredVisualCategory} visual; it must depict this slide's educational concept, not theme decoration.` : "";
    return `S${p.slideIndex + 1} ${p.type}: ${image}.${required}`;
  });
  return [
    `Per-slide layout${about}. Layout types: ${legend}.`,
    ...lines,
    `"No image" means no picture, icon or decorative graphic on that slide. Pictures must show the slide's own content, be age-appropriate, never be cover art or decoration, never sit behind text, and never contain invented labels, numbers or claims.`,
  ].join(" ");
}
