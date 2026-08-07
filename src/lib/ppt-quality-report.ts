/**
 * Internal QA scorecard for a generated PPT deck — NOT wired into the export/render path.
 *
 * Purely a diagnostic tool: run it against a deck (the same StructuredLessonSlideModel[] +
 * image-URL array passed to buildPptxFromTemplateEngine) to get a heuristic quality report.
 * Never renders, never mutates the deck, never affects what a teacher receives.
 */
import { PPT_IMAGE_SLIDE_INDEX_SET, type StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";
import { computeDeckLayoutStats, type SlideLayoutStat } from "@/lib/ppt-template-engine";

export type DeckQualityReport = {
  content_quality: number;
  visual_balance: number;
  image_coverage: number;
  overflow_risk: number;
  warnings: string[];
};

/** Residual-leakage regression guard — same phrases fixed in the content-quality pass. If any
 *  of these ever reappear (e.g. a future edit reintroduces instruction-voice fallback text),
 *  this catches it without needing to touch the locked content-generation file. */
const LEAKED_INSTRUCTION_PATTERNS: RegExp[] = [
  /\bonly[:,]?\s/i,
  /\bverbatim\b/i,
  /\bno activities\b/i,
  /\bno new (teaching )?content\b/i,
  /\bno lesson explanation\b/i,
  /\bdo not (write|include|repeat|add)\b/i,
  /\bthis slide\b/i,
];

const MIN_WORDS_PER_SLIDE = 6;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function computeDeckQualityReport(
  slides: StructuredLessonSlideModel[],
  slideImageUrls?: (string | null)[] | null,
): DeckQualityReport {
  const warnings: string[] = [];
  const stats: SlideLayoutStat[] = computeDeckLayoutStats(slides, slideImageUrls);

  // ── content_quality: leakage regression guard + minimum body length + consecutive-duplicate check ──
  let contentPenalty = 0;
  let prevNorm = "";
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]!;
    const label = `Slide ${i + 1} (${slide.slideTitle})`;
    for (const re of LEAKED_INSTRUCTION_PATTERNS) {
      if (re.test(slide.body)) {
        contentPenalty += 15;
        warnings.push(`${label}: possible leaked instructional phrasing detected (matched ${re}).`);
      }
    }
    const words = countWords(slide.body);
    if (words > 0 && words < MIN_WORDS_PER_SLIDE) {
      contentPenalty += 5;
      warnings.push(`${label}: body is very short (${words} words) — may read as empty/placeholder.`);
    }
    const norm = normLine(slide.body);
    if (norm && norm === prevNorm) {
      contentPenalty += 10;
      warnings.push(`${label}: body is identical to the previous slide.`);
    }
    prevNorm = norm;
  }
  const content_quality = Math.max(0, 100 - contentPenalty);

  // ── image_coverage: filled slots / the deck's actual image-bearing slide indices ──
  // (only PPT_IMAGE_SLIDE_INDEX_SET slides ever get an image slot — e.g. Learning Objectives
  // and Learning Outcomes never do, so they must not count as "missing" an image.)
  const imageEligibleStats = stats.filter((s) => PPT_IMAGE_SLIDE_INDEX_SET.has(s.deckIdx));
  const imagesFilled = imageEligibleStats.filter((s) => s.hasImage).length;
  const image_coverage =
    imageEligibleStats.length > 0 ? Math.round((imagesFilled / imageEligibleStats.length) * 100) : 0;
  const missingImageSlides = imageEligibleStats.filter((s) => !s.hasImage);
  if (missingImageSlides.length > 0) {
    warnings.push(
      `${missingImageSlides.length} slide(s) have no image: ${missingImageSlides.map((s) => `#${s.deckIdx + 1}`).join(", ")}.`,
    );
  }

  // ── overflow_risk: share of slides that needed a "Continued" split ──
  const overflowSlides = stats.filter((s) => s.physicalSlideCount > 1);
  const overflow_risk = Math.round((overflowSlides.length / stats.length) * 100);
  for (const s of overflowSlides) {
    warnings.push(
      `Slide ${s.deckIdx + 1}: content needed ${s.physicalSlideCount} physical slides ("Continued" overflow) — consider whether the source content is too dense for one slide.`,
    );
  }

  // ── visual_balance: how close each slide's content is to comfortably filling its box ──
  // Target band 0.3–0.95 fill ratio reads as "intentionally composed"; below reads sparse
  // (even after vertical centering), at/above 1.0 means it needed to overflow.
  let balancePenalty = 0;
  for (const s of stats) {
    if (s.fillRatio < 0.15) balancePenalty += 8;
    else if (s.fillRatio > 1.0) balancePenalty += 10;
  }
  const visual_balance = Math.max(0, 100 - balancePenalty);

  return {
    content_quality,
    visual_balance,
    image_coverage,
    overflow_risk,
    warnings,
  };
}
