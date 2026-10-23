import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";
import { chunkDeckForSlides, moveTeacherFacingLinesToNotes, normalizeToLines } from "@/lib/ppt-template-engine";
import type { PresentationLanguage } from "@/lib/ppt-language";
import type { GammaConfig } from "./config";
import { layoutInstructionsFor, pictureMediumFor, planSlideLayouts, type CanonicalSlide, type SlideLayoutPlan } from "./visual-plan";

/** Gamma splits cards on this exact delimiter when cardSplit is "inputTextBreaks". */
export const GAMMA_CARD_BREAK = "\n---\n";

export type SlideSnapshot = { index: number; title: string; lines: string[] };

/** What the lesson is about; drives the cover slide. */
export type GammaLessonMeta = { topic: string; subject: string; grade: string; chapter?: string };

/**
 * Gamma is a presentation layer only. The platform deck is the source of truth: the same physical slides (from the
 * platform renderer's own pagination), the same order and the same text, sent with textMode "preserve" and checked
 * line by line afterwards (validate.ts). Gamma decides typography, spacing, hierarchy, colour and a few pictures.
 */
export const GAMMA_DESIGN_INSTRUCTIONS = [
  "This is a school lesson presentation. The input text is the final, approved lesson content; your job is ONLY the visual design.",
  "Keep every word, number, symbol and line exactly as written and in the same order. Do not add, remove, shorten, merge, reword, summarise or translate text, and do not add captions, labels or headings.",
  "Each card is exactly one slide: keep the same number of slides in the same order, and never split or merge cards.",
  "Improve typography, spacing, alignment, colour and visual hierarchy. Keep body text large enough to read from the back of a classroom: when a slide is dense, use a single-column text-first layout with no picture rather than smaller text.",
  "Never leave empty image frames, placeholder boxes, or decorative icons and arrows that take space from text.",
].join(" ");

/** A line of exactly `---` inside a slide would silently create an extra card. */
function neutraliseBreakLine(line: string): { text: string; changed: boolean } {
  return /^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line) ? { text: "", changed: true } : { text: line, changed: false };
}

/** Short label-like lines ("Higher Achievers task", "Response fields:") become sub-headings; the rest are bullets. */
function asMarkdownLine(line: string, isLast: boolean): string {
  const t = line.trim();
  const label = !isLast && t.length <= 48 && !/[.?!]$/.test(t) && !/^\d/.test(t);
  return label ? `### ${t}` : `- ${t}`;
}

/**
 * The platform deck, slide by slide: cover, then each lesson section split exactly as the platform renderer splits
 * it (continuation slides repeat the section title), then the closing takeaway. `hasImage` must describe the
 * platform's own pictures for this request, because a picture narrows the text column and changes the split.
 */
export function buildCanonicalSlides(params: {
  deck: StructuredLessonSlideModel[];
  lesson?: GammaLessonMeta;
  hasImage?: (deckIdx: number) => boolean;
}): CanonicalSlide[] {
  const deck = params.deck.map(moveTeacherFacingLinesToNotes);
  const chunks = chunkDeckForSlides(deck, params.hasImage ?? (() => false), "No content provided.");
  const slides: CanonicalSlide[] = [];
  deck.forEach((model, deckIdx) => {
    const title = model.slideTitle.trim();
    if (deckIdx === 0) {
      const lesson = params.lesson;
      const body = model.body.split("\n").map((l) => l.trim()).filter(Boolean);
      // The platform cover shows "Subject · Grade", the topic as the headline, and the date line.
      const lines = lesson?.topic.trim()
        ? [`${lesson.subject.trim()} · ${lesson.grade.trim()}`, ...(lesson.chapter?.trim() ? [lesson.chapter.trim()] : []), ...body.filter((l) => l !== lesson.grade.trim() && l !== title)]
        : body;
      slides.push({ deckIdx, part: 1, parts: 1, title: lesson?.topic.trim() || title, lines });
      return;
    }
    const parts = chunks[deckIdx]!;
    if (parts.length === 0) {
      slides.push({ deckIdx, part: 1, parts: 1, title, lines: normalizeToLines(model.body) });
      return;
    }
    parts.forEach((lines, i) => slides.push({ deckIdx, part: i + 1, parts: parts.length, title, lines }));
  });
  return slides;
}

export function buildGammaPayload(params: {
  deck: StructuredLessonSlideModel[];
  title: string;
  language: PresentationLanguage;
  config: GammaConfig;
  lesson?: GammaLessonMeta;
  hasImage?: (deckIdx: number) => boolean;
}): { request: Record<string, unknown>; snapshot: SlideSnapshot[]; neutralisedBreaks: number; slides: CanonicalSlide[]; layout: SlideLayoutPlan[] } {
  const slides = buildCanonicalSlides(params);
  let neutralisedBreaks = 0;
  const snapshot: SlideSnapshot[] = [];
  const cards = slides.map((s, index) => {
    const title = neutraliseBreakLine(s.title);
    const lines = s.lines.map(neutraliseBreakLine);
    neutralisedBreaks += Number(title.changed) + lines.filter((l) => l.changed).length;
    const kept = lines.map((l) => l.text.trim()).filter(Boolean);
    snapshot.push({ index, title: title.text, lines: [title.text, ...kept] });
    const body = index === 0 ? kept.join("\n\n") : kept.map((l, i) => asMarkdownLine(l, i === kept.length - 1)).join("\n");
    return [`# ${title.text}`, body].filter((p) => p.trim()).join("\n\n");
  });

  const { config } = params;
  const layout = planSlideLayouts(slides);
  const medium = pictureMediumFor(config.imageSource, config.imageStyle);
  const request: Record<string, unknown> = {
    inputText: cards.join(GAMMA_CARD_BREAK),
    textMode: "preserve",
    format: "presentation",
    // numCards is ignored by Gamma when cardSplit is inputTextBreaks, so it is deliberately not sent.
    cardSplit: "inputTextBreaks",
    exportAs: "pptx",
    title: params.title.slice(0, 500),
    additionalInstructions: `${GAMMA_DESIGN_INSTRUCTIONS} ${layoutInstructionsFor(slides, layout, medium, params.lesson)}`.slice(0, 5000),
    cardOptions: { dimensions: "16x9" },
    textOptions: { language: params.language },
    imageOptions: {
      source: config.imageSource,
      ...(config.imageSource === "aiGenerated" && config.imageModel ? { model: config.imageModel } : {}),
      ...(config.imageSource === "aiGenerated" && config.imageStyle ? { style: config.imageStyle } : {}),
    },
    ...(config.themeId ? { themeId: config.themeId } : {}),
  };
  return { request, snapshot, neutralisedBreaks, slides, layout };
}
