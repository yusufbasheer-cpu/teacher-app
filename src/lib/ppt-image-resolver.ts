/**
 * PPT deck images — generated once during lesson-plan creation (not on download).
 *
 * Split (1-based slide numbers):
 *   Pexels: 1 Title, 2 Starter, 8 UAE link, 9 Plenary, 10 Extended Task
 *   fal.ai: 3 SDG/Chapter, 6 Main Phase, 7 Differentiated, 11 Exit Ticket, 12 Success Criteria
 *
 * Rules: Pexels → fal fallback per slide; fal failures skip; URLs unique within deck; landscape only.
 */

import { isUaeCurriculumFramework } from "@/lib/curriculum-framework";
import { STRUCTURED_LESSON_DECK_SLIDE_COUNT } from "@/lib/ppt-structured-lesson";
import { fetchPexelsUniqueLandscapeUrl } from "@/lib/pexels-images";
import {
  generateLessonPptFluxImageDeduped,
  type LessonPptFluxSlot,
  type PptSlideImageMeta,
} from "@/lib/fal-ppt-slide-images";

export type PptDeckImageMeta = PptSlideImageMeta & {
  curriculumFramework?: string;
};

function slide8PexelsQuery(m: PptDeckImageMeta): string {
  if (isUaeCurriculumFramework(m.curriculumFramework ?? "")) {
    return `UAE Dubai ${m.topic.trim()} education`.replace(/\s+/g, " ").trim();
  }
  return `cross curricular real life ${m.subject.trim()} ${m.topic.trim()} education`
    .replace(/\s+/g, " ")
    .trim();
}

function titleSlidePexelsQuery(m: PptDeckImageMeta): string {
  const subject = m.subject.trim().toLowerCase().replace(/\s+/g, " ");
  return subject ? `${subject} education` : "education";
}

const PEXELS_DECK_SPECS: readonly { idx: number; query: (m: PptDeckImageMeta) => string }[] = [
  {
    idx: 0,
    query: titleSlidePexelsQuery,
  },
  { idx: 1, query: () => "curiosity discovery thinking students" },
  {
    idx: 7,
    query: slide8PexelsQuery,
  },
  { idx: 8, query: () => "reflection classroom learning summary" },
  { idx: 9, query: () => "research study homework learning" },
];

const PEXELS_FALLBACK_SLOT: Record<number, LessonPptFluxSlot> = {
  0: "title_slide_fal_fallback",
  1: "fallback_pexels_starter",
  7: "fallback_pexels_uae",
  8: "fallback_pexels_plenary",
  9: "fallback_pexels_extended",
};

const FAL_PRIMARY_SPECS: readonly { idx: number; slot: LessonPptFluxSlot }[] = [
  { idx: 2, slot: "sdg_chapter" },
  { idx: 5, slot: "main_teaching" },
  { idx: 6, slot: "differentiated_activity" },
  { idx: 10, slot: "exit_ticket" },
  { idx: 11, slot: "success_criteria" },
];

/**
 * Build a full parallel URL array for the 13-slide deck (indices without images stay null).
 */
export async function generatePptDeckSlideImages(meta: PptDeckImageMeta): Promise<(string | null)[]> {
  const deckLen = STRUCTURED_LESSON_DECK_SLIDE_COUNT;
  const deck: (string | null)[] = Array.from({ length: deckLen }, () => null);
  const used = new Set<string>();

  console.log(
    `[ppt-deck-images] start — subject="${meta.subject}", topic="${meta.topic}", deck=${deckLen}`,
  );

  for (const spec of PEXELS_DECK_SPECS) {
    const q = spec.query(meta);
    const slide1Verbose = spec.idx === 0;
    let url = await fetchPexelsUniqueLandscapeUrl(
      q,
      used,
      slide1Verbose ? { verboseLog: true, logLabel: "slide-1-title-pexels" } : undefined,
    );

    if (!url) {
      const falSlot = PEXELS_FALLBACK_SLOT[spec.idx];
      if (falSlot) {
        console.log(`[ppt-deck-images] Pexels failed slide ${spec.idx + 1} — fal fallback (${falSlot})`);
        url = await generateLessonPptFluxImageDeduped(
          meta,
          falSlot,
          used,
          slide1Verbose ? { verboseLog: true, logLabel: "slide-1-title-fal" } : undefined,
        );
      }
    }

    if (url) {
      deck[spec.idx] = url;
      used.add(url);
      console.log(`[ppt-deck-images] slide ${spec.idx + 1} ← ${url.slice(0, 64)}…`);
    } else {
      console.warn(`[ppt-deck-images] slide ${spec.idx + 1} — no image (skipped)`);
    }
  }

  for (const { idx, slot } of FAL_PRIMARY_SPECS) {
    const falVerboseOpts =
      idx === 2
        ? ({ verboseLog: true, logLabel: "slide-3-sdg" } as const)
        : idx === 10
          ? ({ verboseLog: true, logLabel: "slide-11-exit" } as const)
          : idx === 11
            ? ({ verboseLog: true, logLabel: "slide-12-success" } as const)
            : undefined;
    const url = await generateLessonPptFluxImageDeduped(meta, slot, used, falVerboseOpts);
    if (url) {
      deck[idx] = url;
      used.add(url);
      console.log(`[ppt-deck-images] slide ${idx + 1} (${slot}) ← ${url.slice(0, 64)}…`);
    } else {
      console.warn(`[ppt-deck-images] slide ${idx + 1} (${slot}) — fal skipped`);
    }
  }

  const got = deck.filter(Boolean).length;
  console.log(`[ppt-deck-images] done — ${got}/10 image slots filled`);

  return deck;
}

/** @deprecated Prefer generatePptDeckSlideImages during lesson creation. */
export async function fetchPptImagesWithFallback(
  topic: string,
  subject: string,
  grade: string,
  deckSize: number,
): Promise<(string | null)[]> {
  const urls = await generatePptDeckSlideImages({ topic, subject, grade });
  if (deckSize === urls.length) return urls;
  return Array.from({ length: deckSize }, (_, i) => urls[i] ?? null);
}
