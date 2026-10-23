import { slideKindAt } from "@/lib/ppt-template-engine";
import type { GammaLessonMeta } from "./payload";

/** One physical slide of the canonical (platform-paginated) deck. `part` is 1-based within its lesson section. */
export type CanonicalSlide = { deckIdx: number; part: number; parts: number; title: string; lines: string[] };

/** Functional role of a slide; decides its layout and whether it may carry a picture. */
export type SlideType = "title" | "concept" | "worked-example" | "activity" | "questions" | "real-life" | "objectives" | "summary";

/** hero: large (cover only) · side: one picture in a column ≤ 1/3 width · inset: one small picture ≤ 1/4 · none. */
export type ImagePlan = "hero" | "side" | "inset" | "none";

export type SlideLayoutPlan = { slideIndex: number; type: SlideType; image: ImagePlan; reason: string };

import { pictureMediumFor, type PictureMedium } from "./picture-medium";
export { pictureMediumFor, type PictureMedium };

/** Text density limits per picture size. ponytail: character counts, not a layout measurement; tune from real decks. */
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

/**
 * Content first: a picture is allowed only where it can help without taking text space. Continuation slides,
 * questions, objectives, worked examples and summaries never get one; dense slides lose theirs.
 */
export function planSlideLayouts(slides: CanonicalSlide[]): SlideLayoutPlan[] {
  return slides.map((s, slideIndex) => {
    const type = classifySlide(s);
    const chars = charsOf(s);
    const plan = (image: ImagePlan, reason: string): SlideLayoutPlan => ({ slideIndex, type, image, reason });
    if (type === "title") return plan("hero", "Cover: a strong opening image.");
    if (s.part > 1) return plan("none", "Continuation slide: all space goes to the content.");
    if ((type === "concept" || type === "real-life") && chars <= SIDE_IMAGE_MAX_CHARS) return plan("side", "One relevant picture supports the explanation.");
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
  return "educational illustration or simple diagram";
}

/** Compact per-slide brief (a legend once, then one short line per slide) so 25 slides still fit Gamma's 5000 chars. */
export function layoutInstructionsFor(slides: CanonicalSlide[], plans: SlideLayoutPlan[], medium: PictureMedium, lesson?: GammaLessonMeta): string {
  const noun = pictureNoun(medium);
  const about = lesson?.topic.trim() ? ` (lesson: ${lesson.topic.trim()})` : "";
  const legend = (Object.keys(LAYOUT_RULES) as SlideType[]).map((t) => `${t} = ${LAYOUT_RULES[t]}`).join("; ");
  const lines = plans.map((p) => {
    const image = medium === "none" || p.image === "none"
      ? "no image"
      : p.image === "hero"
        ? `large ${noun}`
        : p.image === "side"
          ? `one ${noun} of "${slides[p.slideIndex]!.title}" in a side column, max 1/3 width`
          : `one small ${noun} of "${slides[p.slideIndex]!.title}", max 1/4 of the slide`;
    return `S${p.slideIndex + 1} ${p.type}: ${image}.`;
  });
  return [
    `Per-slide layout${about}. Layout types: ${legend}.`,
    ...lines,
    `"No image" means no picture, icon or decorative graphic on that slide. Pictures must show the slide's own content, be age-appropriate, prefer diagrams over decoration, never sit behind text, and never contain invented labels, numbers or claims.`,
  ].join(" ");
}
