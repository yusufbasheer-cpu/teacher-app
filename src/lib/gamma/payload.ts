import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";
import { moveTeacherFacingLinesToNotes } from "@/lib/ppt-template-engine";
import type { PresentationLanguage } from "@/lib/ppt-language";
import type { GammaConfig } from "./config";
import { planGammaVisuals, visualInstructionsFor, type GammaVisualBrief } from "./visual-plan";

/** Gamma splits cards on this exact delimiter when cardSplit is "inputTextBreaks". */
export const GAMMA_CARD_BREAK = "\n---\n";

export type SlideSnapshot = { index: number; title: string; lines: string[] };

export const GAMMA_DESIGN_INSTRUCTIONS = [
  "This is a school lesson. Improve ONLY the visual design: layout, typography, colour, spacing and imagery.",
  "Do NOT add, remove, reword, shorten, summarise, translate or reorder any text. Keep every title, objective, question, answer, number, formula and instruction exactly as written.",
  "Do NOT invent facts, activities, examples, labels or captions. Every card in the input is one slide; keep one slide per card.",
  "Use clean, readable classroom typography, generous spacing and a consistent calm colour palette. Vary layouts by content type (lists, steps, questions) but never shrink text to unreadable sizes or clip it.",
  "Use imagery only where it clearly helps the slide's own topic: simple, age-appropriate, uncluttered educational visuals. Do not use generic icons, decorative backgrounds or stock-looking filler.",
  "Prefer classroom-readable split layouts, generous spacing, aligned margins and a clear visual hierarchy. Never solve crowding by removing content or shrinking text to unreadable sizes.",
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

export function buildGammaPayload(params: {
  deck: StructuredLessonSlideModel[];
  title: string;
  language: PresentationLanguage;
  config: GammaConfig;
}): { request: Record<string, unknown>; snapshot: SlideSnapshot[]; neutralisedBreaks: number; visualBriefs: GammaVisualBrief[] } {
  let neutralisedBreaks = 0;
  const snapshot: SlideSnapshot[] = [];
  const cards = params.deck.map((raw, index) => {
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

  const { config } = params;
  const visualBriefs = planGammaVisuals(params.deck);
  const request: Record<string, unknown> = {
    inputText: cards.join(GAMMA_CARD_BREAK),
    textMode: "preserve",
    format: "presentation",
    // numCards is ignored by Gamma when cardSplit is inputTextBreaks, so it is deliberately not sent.
    cardSplit: "inputTextBreaks",
    exportAs: "pptx",
    title: params.title.slice(0, 500),
    additionalInstructions: `${GAMMA_DESIGN_INSTRUCTIONS} ${visualInstructionsFor(visualBriefs)}`,
    cardOptions: { dimensions: "16x9" },
    textOptions: { language: params.language },
    imageOptions: {
      source: config.imageSource,
      ...(config.imageSource === "aiGenerated" && config.imageModel ? { model: config.imageModel } : {}),
      ...(config.imageSource === "aiGenerated" && config.imageStyle ? { style: config.imageStyle } : {}),
    },
    ...(config.themeId ? { themeId: config.themeId } : {}),
  };
  return { request, snapshot, neutralisedBreaks, visualBriefs };
}
