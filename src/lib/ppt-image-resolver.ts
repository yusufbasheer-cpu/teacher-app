/**
 * PPT deck images — generated once during lesson-plan creation (not on download).
 *
 * Fal AI (Flux) is the primary source for every image slide (all 10 image slots, deck indices
 * 0,1,2,5,6,7,8,9,10,11) — consistent flat-illustration style instead of mixed-in stock photos.
 * Pexels is kept only as a fallback for the 5 slides that have a matching photo query, used if
 * Fal fails (rate limit, circuit open, missing credentials) or returns nothing.
 */

import { isUaeCurriculumFramework } from "@/lib/curriculum-framework";
import { logPexelsEnvStatus, resolvePexelsApiKey } from "@/lib/image-api-env";
import { STRUCTURED_LESSON_DECK_SLIDE_COUNT } from "@/lib/ppt-structured-lesson";
import {
  fetchPexelsUniqueLandscapeUrl,
  generateLessonPptFluxImageDeduped,
  getFalCredentials,
  getFalPptCircuitOpenReason,
  type LessonPptFluxSlot,
  type PptSlideImageMeta,
} from "@/lib/ai-facade";

export type PptDeckImageMeta = PptSlideImageMeta & {
  curriculumFramework?: string;
};

const PEXELS_SLIDE_LABELS: Record<number, string> = {
  0: "slide-1-title",
  1: "slide-2-starter",
  7: "slide-8-connection",
  8: "slide-9-plenary",
  9: "slide-10-extended",
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

/** Every image slide, in deck order. Fal is always primary; `pexelsQuery` is a fallback-only path. */
const DECK_IMAGE_SPECS: readonly {
  idx: number;
  slideNumber1Based: number;
  falSlot: LessonPptFluxSlot;
  pexelsQuery?: (m: PptDeckImageMeta) => string;
}[] = [
  { idx: 0, slideNumber1Based: 1, falSlot: "title_slide_fal_fallback", pexelsQuery: titleSlidePexelsQuery },
  { idx: 1, slideNumber1Based: 2, falSlot: "fallback_pexels_starter", pexelsQuery: () => "curiosity discovery thinking students" },
  { idx: 2, slideNumber1Based: 3, falSlot: "sdg_chapter" },
  { idx: 5, slideNumber1Based: 6, falSlot: "main_teaching" },
  { idx: 6, slideNumber1Based: 7, falSlot: "differentiated_activity" },
  { idx: 7, slideNumber1Based: 8, falSlot: "fallback_pexels_uae", pexelsQuery: slide8PexelsQuery },
  { idx: 8, slideNumber1Based: 9, falSlot: "fallback_pexels_plenary", pexelsQuery: () => "reflection classroom learning summary" },
  { idx: 9, slideNumber1Based: 10, falSlot: "fallback_pexels_extended", pexelsQuery: () => "research study homework learning" },
  { idx: 10, slideNumber1Based: 11, falSlot: "exit_ticket" },
  { idx: 11, slideNumber1Based: 12, falSlot: "success_criteria" },
];

export type PptDeckImageGenerationResult = {
  urls: (string | null)[];
  notices: string[];
};

function logDeckAssignment(deck: (string | null)[]): void {
  console.log("[ppt-deck-images] final URL assignment to deck indices:");
  for (const spec of DECK_IMAGE_SPECS) {
    const url = deck[spec.idx];
    const label = PEXELS_SLIDE_LABELS[spec.idx] ?? `slide-${spec.slideNumber1Based}`;
    console.log(`  deck[${spec.idx}] (${label}): ${url ? `SET → ${url.slice(0, 100)}…` : "null (no image)"}`);
  }
}

export async function generatePptDeckSlideImages(
  meta: PptDeckImageMeta,
): Promise<PptDeckImageGenerationResult> {
  const deckLen = STRUCTURED_LESSON_DECK_SLIDE_COUNT;
  const deck: (string | null)[] = Array.from({ length: deckLen }, () => null);
  const used = new Set<string>();
  const notices: string[] = [];

  const falOk = Boolean(getFalCredentials());
  const falCircuit = getFalPptCircuitOpenReason();
  const pexelsOk = Boolean(resolvePexelsApiKey());

  console.log(
    `[ppt-deck-images] start — subject="${meta.subject}", topic="${meta.topic}", deck=${deckLen}, ` +
      `fal=${falOk ? "ready" : "missing"}, falCircuitOpen=${falCircuit ? "YES" : "NO"}, pexelsFallback=${pexelsOk ? "ready" : "missing"}`,
  );
  if (pexelsOk) logPexelsEnvStatus("ppt-deck-pexels-fallback");

  if (!falOk || falCircuit) {
    notices.push(
      falCircuit ?? "Fal AI image generation is not configured (FAL_API_KEY missing) — slide images will be limited.",
    );
  }

  // Resolve all 10 slots in parallel — each fal call can take up to FAL_IMAGE_TIMEOUT_MS (90s) to
  // time out, and running them sequentially (as this loop originally did) meant a worst case of
  // 10x that (15 minutes) blocking lesson creation. In parallel, worst case is ~1 fal round trip.
  const resolved = await Promise.all(
    DECK_IMAGE_SPECS.map(async (spec) => {
      const label = PEXELS_SLIDE_LABELS[spec.idx] ?? `slide-${spec.slideNumber1Based}`;
      let url: string | null = null;

      if (falOk && !falCircuit) {
        url = await generateLessonPptFluxImageDeduped(meta, spec.falSlot, used, {
          verboseLog: true,
          logLabel: label,
        });
      }

      if (!url && spec.pexelsQuery && pexelsOk) {
        const q = spec.pexelsQuery(meta);
        console.log(`[ppt-deck-images] fal unavailable/failed for ${label} — falling back to Pexels query="${q}"`);
        url = await fetchPexelsUniqueLandscapeUrl(q, used, {
          verboseLog: true,
          logLabel: `${label}-pexels-fallback`,
          slideNumber1Based: spec.slideNumber1Based,
        });
      }

      return { spec, label, url };
    }),
  );

  for (const { spec, label, url } of resolved) {
    if (url) {
      deck[spec.idx] = url;
      used.add(url);
    } else {
      console.warn(`[ppt-deck-images] deck[${spec.idx}] slide ${spec.slideNumber1Based} (${label}) — NO IMAGE`);
    }
  }

  logDeckAssignment(deck);

  const got = deck.filter(Boolean).length;
  console.log(`[ppt-deck-images] done — ${got}/${DECK_IMAGE_SPECS.length} slots filled`);

  return { urls: deck, notices };
}

/** @deprecated Prefer generatePptDeckSlideImages during lesson creation. */
export async function fetchPptImagesWithFallback(
  topic: string,
  subject: string,
  grade: string,
  deckSize: number,
): Promise<(string | null)[]> {
  const { urls } = await generatePptDeckSlideImages({ topic, subject, grade });
  if (deckSize === urls.length) return urls;
  return Array.from({ length: deckSize }, (_, i) => urls[i] ?? null);
}
