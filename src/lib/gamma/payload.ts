import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";
import { moveTeacherFacingLinesToNotes } from "@/lib/ppt-template-engine";
import type { PresentationLanguage } from "@/lib/ppt-language";
import type { GammaConfig } from "./config";
import { pictureMediumFor, planGammaVisuals, visualInstructionsFor, type GammaVisualBrief } from "./visual-plan";

/** Gamma splits cards on this exact delimiter when cardSplit is "inputTextBreaks". */
export const GAMMA_CARD_BREAK = "\n---\n";

export type SlideSnapshot = { index: number; title: string; lines: string[] };

/** What the lesson is about; drives the cover slide and Gamma's audience/tone. */
export type GammaLessonMeta = { topic: string; subject: string; grade: string; chapter?: string };

/**
 * Our slide text is written like a worksheet (full sentences, every instruction spelled out). Sending it with
 * textMode "preserve" forced Gamma to paste it verbatim, which is why decks came out as plain walls of text.
 * "condense" lets Gamma lay it out as slides, but content quality comes first: it may tighten wording, never drop
 * items, and pictures stay small on content slides. validate.ts checks slide count, titles, objectives and figures.
 */
export const GAMMA_DESIGN_INSTRUCTIONS = [
  "This is a school lesson presentation that a teacher will project in class. The lesson content is the priority; design serves it.",
  "Each card in the input is exactly one slide. Keep one slide per card, in the same order. Keep every slide title exactly as written.",
  "Keep ALL of the content: every step, instruction, question, example, success criterion, learning objective, number, unit, formula and key term must appear on its slide. You may only tighten wording (remove filler words, turn sentences into clear bullets or numbered steps); never drop, merge away or summarise items.",
  "Do not add facts, examples, activities, data or claims that are not in the input.",
  "Content takes most of every slide: text and lists should fill at least two-thirds of the slide. On content slides an image is a small supporting inset or a narrow side column of at most one-third of the slide width, never a half-slide or full-slide background. Only the cover slide may use a large image.",
  "Use a clear visual hierarchy, consistent alignment, cards or columns for parallel items, and text large enough to read from the back of a classroom.",
  "Never leave empty image frames, blank boxes, placeholder shapes or decorative arrows without text.",
].join(" ");

/** A line of exactly `---` inside a slide would silently create an extra card. */
function neutraliseBreakLines(text: string): { text: string; changed: number } {
  let changed = 0;
  const out = text
    .split("\n")
    .map((line) => {
      if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) {
        changed++;
        return "";
      }
      return line;
    })
    .join("\n");
  return { text: out, changed };
}

/** The legacy deck's cover is titled "Subject, Grade"; a Gamma cover leads with the lesson topic instead. */
function coverSlide(slide: StructuredLessonSlideModel, lesson: GammaLessonMeta): StructuredLessonSlideModel {
  const topic = lesson.topic.trim();
  if (!topic) return slide;
  const subtitle = [lesson.subject.trim(), lesson.grade.trim()].filter(Boolean).join(" · ");
  const kept = slide.body.split("\n").map((l) => l.trim()).filter((l) => l && l !== lesson.grade.trim() && l !== slide.slideTitle.trim());
  const body = [subtitle, lesson.chapter?.trim() ?? "", ...kept].filter(Boolean).join("\n");
  return { ...slide, slideTitle: topic, body };
}

export function buildGammaPayload(params: {
  deck: StructuredLessonSlideModel[];
  title: string;
  language: PresentationLanguage;
  config: GammaConfig;
  lesson?: GammaLessonMeta;
}): { request: Record<string, unknown>; snapshot: SlideSnapshot[]; neutralisedBreaks: number; visualBriefs: GammaVisualBrief[] } {
  let neutralisedBreaks = 0;
  const snapshot: SlideSnapshot[] = [];
  const deck = params.lesson && params.deck.length > 0 ? [coverSlide(params.deck[0]!, params.lesson), ...params.deck.slice(1)] : params.deck;
  const cards = deck.map((raw, index) => {
    // Same student-facing filter the legacy renderer applies; teacher-facing lines stay in notes (not sent).
    const slide = moveTeacherFacingLinesToNotes(raw);
    const title = neutraliseBreakLines(slide.slideTitle.trim());
    const body = neutraliseBreakLines(slide.body.replace(/\r\n/g, "\n").trim());
    const afl = slide.aflCallout?.trim() ? neutraliseBreakLines(slide.aflCallout.trim()) : null;
    neutralisedBreaks += title.changed + body.changed + (afl?.changed ?? 0);
    const parts = [`# ${title.text}`, body.text, ...(afl ? [afl.text] : [])].filter((p) => p.trim());
    const lines = [title.text, ...body.text.split("\n"), ...(afl ? afl.text.split("\n") : [])]
      .map((l) => l.trim())
      .filter(Boolean);
    snapshot.push({ index, title: title.text, lines });
    return parts.join("\n\n");
  });

  const { config, lesson } = params;
  const visualBriefs = planGammaVisuals(deck, lesson);
  const audience = lesson ? `${lesson.grade} ${lesson.subject} students and their teacher`.trim() : "school students and their teacher";
  const request: Record<string, unknown> = {
    inputText: cards.join(GAMMA_CARD_BREAK),
    textMode: "condense",
    format: "presentation",
    // numCards is ignored by Gamma when cardSplit is inputTextBreaks, so it is deliberately not sent.
    cardSplit: "inputTextBreaks",
    exportAs: "pptx",
    title: params.title.slice(0, 500),
    additionalInstructions: `${GAMMA_DESIGN_INSTRUCTIONS} ${visualInstructionsFor(visualBriefs, pictureMediumFor(config.imageSource, config.imageStyle))}`.slice(0, 5000),
    cardOptions: { dimensions: "16x9" },
    textOptions: {
      language: params.language,
      // "detailed": keep the lesson's substance; the instructions above only allow tightening wording.
      amount: "detailed",
      audience: audience.slice(0, 500),
      tone: "clear, warm and encouraging; classroom-ready",
    },
    imageOptions: {
      source: config.imageSource,
      ...(config.imageSource === "aiGenerated" && config.imageModel ? { model: config.imageModel } : {}),
      ...(config.imageSource === "aiGenerated" && config.imageStyle ? { style: config.imageStyle } : {}),
    },
    ...(config.themeId ? { themeId: config.themeId } : {}),
  };
  return { request, snapshot, neutralisedBreaks, visualBriefs };
}
