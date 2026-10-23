import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";
import type { GammaLessonMeta } from "./payload";

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

/** Above this much body text a slide gets no picture. ponytail: a character count, not a layout measurement; tune from real decks. */
export const DENSE_SLIDE_CHARS = 450;

function textOf(slide: StructuredLessonSlideModel): string {
  return [slide.slideTitle, slide.body, slide.aflCallout ?? ""].join(" ").trim();
}

/**
 * Every slide with an image slot gets a brief. Specific subjects keep their diagram rules; anything else falls back
 * to an illustration of the slide's own title within the lesson topic. (Previously only the thermodynamics rules
 * existed, so a lesson on any other topic told Gamma "no images" and came back as plain text slides.)
 */
export function planGammaVisuals(deck: StructuredLessonSlideModel[], lesson?: GammaLessonMeta): GammaVisualBrief[] {
  const topic = lesson?.topic.trim();
  return deck.map((slide, slideIndex) => {
    const text = textOf(slide);
    if (!slide.includeImageSlot || text.length === 0) {
      return { slideIndex, needsImage: false, visualType: "none", subject: "", layout: "text-first", reason: "This slide has no image slot." };
    }
    // Content before pictures: a text-heavy slide needs the whole slide for its content.
    if (slideIndex > 0 && slide.body.length > DENSE_SLIDE_CHARS) {
      return { slideIndex, needsImage: false, visualType: "none", subject: "", layout: "text-first", reason: "Dense slide: the content needs the space." };
    }
    const rule = RULES.find((candidate) => candidate.terms.test(text));
    if (rule) return { slideIndex, needsImage: true, visualType: rule.visualType, subject: rule.subject, layout: "split", reason: rule.reason };
    const title = slide.slideTitle.trim();
    const subject = topic && title !== topic ? `"${title}" in a lesson about ${topic}` : `"${title || topic}"`;
    return { slideIndex, needsImage: true, visualType: "illustration", subject, layout: slideIndex === 0 ? "full-bleed" : "split", reason: "Illustrates the slide's own subject." };
  });
}

/** What kind of picture the teacher asked for; the brief must describe that, not always "an illustration". */
export type PictureMedium = "illustration" | "realistic" | "photo" | "none";

export function pictureMediumFor(source: string, style?: string): PictureMedium {
  if (source === "noImages" || source === "themeAccent") return "none";
  if (source === "pexels" || source.startsWith("web")) return "photo";
  return /photo|realistic/i.test(style ?? "") ? "realistic" : "illustration";
}

function pictureFor(brief: GammaVisualBrief, medium: PictureMedium): string {
  // A stock photo cannot be a diagram, so the photo media describe a scene instead of the diagram type.
  if (medium === "photo") return `a real photograph showing ${brief.subject}`;
  if (medium === "realistic") return `a photorealistic image of ${brief.subject}`;
  return `a ${brief.visualType} of ${brief.subject}`;
}

export function visualInstructionsFor(briefs: GammaVisualBrief[], medium: PictureMedium = "illustration"): string {
  const required = medium === "none" ? [] : briefs.filter((brief) => brief.needsImage);
  if (required.length === 0) return "No slide requires an image; keep the text-first layout and do not add decorative imagery.";
  const lines = required.map((brief) => `Slide ${brief.slideIndex + 1}: ${pictureFor(brief, medium)}${brief.layout === "full-bleed" ? " as a large hero image" : " as a small inset beside the text (at most one-third of the slide width)"}.`);
  return [
    "Images: use the following visual brief. It supplements the slide text; it does not rewrite or add facts to it.",
    ...lines,
    "Slides not listed may use the theme's accents but need no image.",
    "Images must be educational, topic-specific and age-appropriate, not generic icons, gradients, backgrounds, or stock decoration.",
    "Do not invent data labels, numerical values, formulas, captions, or scientific claims. Do not crop, overlap, or shrink text to fit.",
  ].join(" ");
}
