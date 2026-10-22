import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";

export type GammaVisualBrief = {
  slideIndex: number;
  needsImage: boolean;
  visualType: "concept-diagram" | "worked-example" | "process-flow" | "comparison" | "illustration" | "none";
  subject: string;
  layout: "split" | "full-bleed" | "text-first";
  reason: string;
};

type Rule = { terms: RegExp; visualType: GammaVisualBrief["visualType"]; subject: string; reason: string };

const RULES: Rule[] = [
  { terms: /heat transfer|conduction|convection|radiation/i, visualType: "concept-diagram", subject: "heat transfer between objects, with directional arrows", reason: "A spatial mechanism is easier to learn as a diagram than prose." },
  { terms: /specific heat|calculation|calculate|equation|formula|numerical|joule|temperature change/i, visualType: "worked-example", subject: "a clean worked calculation using only the numbers and symbols already on the slide", reason: "The slide contains a quantitative relationship that benefits from visual sequencing." },
  { terms: /power generation|energy conversion|energy transfer|electricity|turbine|generator/i, visualType: "process-flow", subject: "an energy-conversion flow from the named input to the named output", reason: "The content describes a sequence or transformation." },
  { terms: /insulation|double glazing|thermos|thermal conductivity/i, visualType: "concept-diagram", subject: "a cross-section showing the insulating layers named on the slide", reason: "A cross-section makes the material structure observable." },
  { terms: /urban heat island|green space|city|vegetation/i, visualType: "comparison", subject: "a city-versus-green-space comparison using the slide's own labels", reason: "The concept depends on contrasting environments." },
  { terms: /cycle|stages|step|process|sequence|flow/i, visualType: "process-flow", subject: "a simple left-to-right process flow for the named stages", reason: "The content has ordered stages." },
];

function textOf(slide: StructuredLessonSlideModel): string {
  return [slide.slideTitle, slide.body, slide.aflCallout ?? ""].join(" ").trim();
}

export function planGammaVisuals(deck: StructuredLessonSlideModel[]): GammaVisualBrief[] {
  return deck.map((slide, slideIndex) => {
    const text = textOf(slide);
    const rule = RULES.find((candidate) => candidate.terms.test(text));
    if (!rule || !slide.includeImageSlot || text.length === 0) {
      return { slideIndex, needsImage: false, visualType: "none", subject: "", layout: "text-first", reason: "No deterministic educational visual requirement was found." };
    }
    return { slideIndex, needsImage: true, visualType: rule.visualType, subject: rule.subject, layout: "split", reason: rule.reason };
  });
}

export function visualInstructionsFor(briefs: GammaVisualBrief[]): string {
  const required = briefs.filter((brief) => brief.needsImage);
  if (required.length === 0) return "No slide requires an image; keep the text-first layout and do not add decorative imagery.";
  const lines = required.map((brief) => `Slide ${brief.slideIndex + 1}: use a ${brief.visualType} about ${brief.subject}. Keep it in a balanced split layout with readable text.`);
  return [
    "Use the following deterministic visual brief. It supplements the slide text; it does not rewrite, summarize, label, or add facts to it.",
    ...lines,
    "Images must be educational and topic-specific, not generic icons, gradients, backgrounds, or stock decoration.",
    "Do not invent data labels, numerical values, formulas, captions, or scientific claims. Do not crop, overlap, or shrink text to fit.",
  ].join(" ");
}
