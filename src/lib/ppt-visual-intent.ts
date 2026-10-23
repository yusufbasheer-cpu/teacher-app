import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";

export type RequiredVisualCategory =
  | "cover"
  | "starter"
  | "topic"
  | "main-phase"
  | "uae-connection"
  | "takeaway";

export const REQUIRED_VISUAL_DECK_INDEX: Readonly<Record<RequiredVisualCategory, number>> = {
  cover: 0,
  starter: 1,
  topic: 2,
  "main-phase": 5,
  "uae-connection": 7,
  takeaway: 12,
};
export const REQUIRED_VISUAL_DECK_INDICES = [0, 1, 2, 5, 7, 12] as const;

export const REQUIRED_VISUAL_CATEGORIES = Object.keys(REQUIRED_VISUAL_DECK_INDEX) as RequiredVisualCategory[];

export type VisualAssetStatus = "unresolved" | "resolved" | "missing" | "provider-generated-unverified";

export type RequiredVisualIntent = {
  category: RequiredVisualCategory;
  logicalSlideId: string;
  deckIndex: number;
  required: true;
  educationalConcept: string;
  imageDescription: string;
  imageSource: "fal" | "pexels" | "gamma" | "cached" | "none";
  assetStatus: VisualAssetStatus;
  resolvedImageReference?: string;
  validationResult: "pending" | "verified" | "unverified" | "missing";
};

function concise(value: string, fallback: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, 260);
}

export function buildRequiredVisualIntents(params: {
  deck: StructuredLessonSlideModel[];
  topic: string;
  subject: string;
  grade: string;
  curriculumFramework?: string;
}): RequiredVisualIntent[] {
  const { deck, topic, subject, grade } = params;
  return REQUIRED_VISUAL_CATEGORIES.map((category) => {
    const deckIndex = REQUIRED_VISUAL_DECK_INDEX[category];
    const slide = deck[deckIndex];
    const content = concise(slide?.body ?? "", topic);
    const descriptions: Record<RequiredVisualCategory, string> = {
      cover: `A clear subject-specific hero illustration of ${topic} for ${grade} ${subject}; no embedded words.`,
      starter: `A visual that directly supports the starter observation or question: ${content}`,
      topic: `A factual overview illustration introducing ${topic} and its key relationships.`,
      "main-phase": `A compact educational concept diagram or task illustration supporting: ${content}`,
      "uae-connection": `A context-specific real-life visual based on the actual connection: ${content}`,
      takeaway: `A simple accurate visual reinforcing the main learning about ${topic}: ${content}`,
    };
    return {
      category,
      logicalSlideId: `lesson-${category}`,
      deckIndex,
      required: true as const,
      educationalConcept: concise(content, topic),
      imageDescription: descriptions[category],
      imageSource: "none" as const,
      assetStatus: "unresolved" as const,
      validationResult: "pending" as const,
    };
  });
}

export type PhysicalVisualSlide = { deckIdx: number };
export type ExtractedVisualSlide = { pictures: number };

export type VisualCoverageCategoryResult = {
  category: RequiredVisualCategory;
  deckIndex: number;
  physicalSlides: number[];
  pictureCount: number;
  status: "verified" | "unverified" | "missing";
  reason: string;
};

export type RequiredVisualCoverageReport = {
  verdict: "passed" | "uncertain" | "failed";
  categories: VisualCoverageCategoryResult[];
  reasons: string[];
};

/**
 * Picture XML proves presence only. Relevance is verified solely when a resolved semantic asset
 * is mapped to the logical category; Gamma/theme pictures without provenance remain unverified.
 */
export function verifyRequiredVisualCoverage(params: {
  intents: RequiredVisualIntent[];
  physicalSlides: PhysicalVisualSlide[];
  actualSlides: ExtractedVisualSlide[];
}): RequiredVisualCoverageReport {
  const categories = params.intents.map((intent): VisualCoverageCategoryResult => {
    const physicalSlides = params.physicalSlides
      .map((slide, index) => slide.deckIdx === intent.deckIndex ? index + 1 : 0)
      .filter(Boolean);
    const pictureCount = physicalSlides.reduce((sum, slideNumber) => sum + (params.actualSlides[slideNumber - 1]?.pictures ?? 0), 0);
    if (pictureCount === 0) {
      return { category: intent.category, deckIndex: intent.deckIndex, physicalSlides, pictureCount, status: "missing", reason: "No picture object appears in this logical element's physical slide range." };
    }
    if (intent.assetStatus === "resolved" && intent.resolvedImageReference) {
      return { category: intent.category, deckIndex: intent.deckIndex, physicalSlides, pictureCount, status: "verified", reason: "A resolved semantic asset is mapped to this logical element and is present in the PPTX." };
    }
    return { category: intent.category, deckIndex: intent.deckIndex, physicalSlides, pictureCount, status: "unverified", reason: "Picture XML is present, but semantic asset provenance is unavailable; theme decoration is not counted as verified relevance." };
  });
  const missing = categories.filter((item) => item.status === "missing");
  const unverified = categories.filter((item) => item.status === "unverified");
  return {
    verdict: missing.length ? "failed" : unverified.length ? "uncertain" : "passed",
    categories,
    reasons: [
      ...missing.map((item) => `${item.category}: missing required visual`),
      ...unverified.map((item) => `${item.category}: visual relevance unverified`),
    ],
  };
}
