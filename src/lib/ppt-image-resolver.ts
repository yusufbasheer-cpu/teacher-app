/**
 * PPT deck images — generated once during lesson-plan creation (not on download).
 *
 * Phase 1 — Pexels only (slides 1, 2, 8, 9, 10): runs first, independent of fal.ai.
 * Phase 2 — fal.ai (slides 3, 6, 7, 11, 12): optional; failures do not block Pexels.
 */

import { getFalCredentials } from "@/lib/fal-flux-section-images";
import { isUaeCurriculumFramework } from "@/lib/curriculum-framework";
import { logPexelsEnvStatus, resolvePexelsApiKey } from "@/lib/image-api-env";
import { STRUCTURED_LESSON_DECK_SLIDE_COUNT } from "@/lib/ppt-structured-lesson";
import { fetchPexelsUniqueLandscapeUrl } from "@/lib/pexels-images";
import {
  generateLessonPptFluxImageDeduped,
  getFalPptCircuitOpenReason,
  type LessonPptFluxSlot,
  type PptSlideImageMeta,
} from "@/lib/fal-ppt-slide-images";

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

const PEXELS_DECK_SPECS: readonly {
  idx: number;
  slideNumber1Based: number;
  query: (m: PptDeckImageMeta) => string;
}[] = [
  { idx: 0, slideNumber1Based: 1, query: titleSlidePexelsQuery },
  { idx: 1, slideNumber1Based: 2, query: () => "curiosity discovery thinking students" },
  { idx: 7, slideNumber1Based: 8, query: slide8PexelsQuery },
  { idx: 8, slideNumber1Based: 9, query: () => "reflection classroom learning summary" },
  { idx: 9, slideNumber1Based: 10, query: () => "research study homework learning" },
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

export type PptDeckImageGenerationResult = {
  urls: (string | null)[];
  notices: string[];
};

function logDeckPexelsAssignment(deck: (string | null)[], phase: string): void {
  console.log(`[ppt-deck-images][${phase}] Pexels URL assignment to deck indices:`);
  for (const idx of [0, 1, 7, 8, 9]) {
    const url = deck[idx];
    const label = PEXELS_SLIDE_LABELS[idx] ?? `index-${idx}`;
    console.log(
      `  deck[${idx}] (${label}): ${url ? `SET → ${url.slice(0, 100)}…` : "null (no image)"}`,
    );
  }
}

/**
 * Phase 1: Pexels only — never waits on fal.ai.
 */
async function runPexelsPhase(
  meta: PptDeckImageMeta,
  deck: (string | null)[],
  used: Set<string>,
  notices: string[],
  skipFalFallback: boolean,
): Promise<void> {
  console.log("[ppt-deck-images] ═══ PHASE 1: PEXELS ONLY (independent of fal.ai) ═══");
  logPexelsEnvStatus("ppt-deck-pexels-phase");

  const pexelsOk = Boolean(resolvePexelsApiKey());
  if (!pexelsOk) {
    notices.push(
      "Pexels images skipped: set a valid PEXELS_API_KEY from https://www.pexels.com/api/ in .env.local (not a URL).",
    );
    console.warn("[ppt-deck-images] Pexels phase SKIPPED — invalid/missing API key");
    return;
  }

  for (const spec of PEXELS_DECK_SPECS) {
    const label = PEXELS_SLIDE_LABELS[spec.idx] ?? `slide-${spec.slideNumber1Based}`;
    const q = spec.query(meta);

    console.log(
      `[ppt-deck-images] Pexels call START — slide ${spec.slideNumber1Based} → deck[${spec.idx}] query="${q}"`,
    );

    let url = await fetchPexelsUniqueLandscapeUrl(q, used, {
      verboseLog: true,
      logLabel: label,
      slideNumber1Based: spec.slideNumber1Based,
    });

    if (!url && !skipFalFallback) {
      const falSlot = PEXELS_FALLBACK_SLOT[spec.idx];
      if (falSlot) {
        console.log(
          `[ppt-deck-images] Pexels returned null for slide ${spec.slideNumber1Based} — trying fal fallback (${falSlot})`,
        );
        url = await generateLessonPptFluxImageDeduped(meta, falSlot, used, {
          verboseLog: true,
          logLabel: `${label}-fal-fallback`,
        });
      }
    } else if (!url && skipFalFallback) {
      console.warn(
        `[ppt-deck-images] Pexels returned null for slide ${spec.slideNumber1Based} — fal fallback SKIPPED (fal unavailable)`,
      );
    }

    if (url) {
      deck[spec.idx] = url;
      used.add(url);
      console.log(
        `[ppt-deck-images] deck[${spec.idx}] slide ${spec.slideNumber1Based} ASSIGNED ← ${url.slice(0, 96)}…`,
      );
    } else {
      console.warn(`[ppt-deck-images] deck[${spec.idx}] slide ${spec.slideNumber1Based} — NO IMAGE`);
    }
  }

  logDeckPexelsAssignment(deck, "after-pexels-phase");
}

/**
 * Phase 2: fal.ai slots only — runs after Pexels; failures do not affect Pexels URLs already set.
 */
async function runFalPhase(
  meta: PptDeckImageMeta,
  deck: (string | null)[],
  used: Set<string>,
  notices: string[],
): Promise<void> {
  const falOk = Boolean(getFalCredentials());
  const falCircuit = getFalPptCircuitOpenReason();

  console.log("[ppt-deck-images] ═══ PHASE 2: fal.ai (optional, after Pexels) ═══");
  console.log(`[ppt-deck-images] fal credentials: ${falOk ? "present" : "missing"}, circuitOpen=${falCircuit ? "YES" : "NO"}`);

  if (!falOk) {
    notices.push("fal.ai images skipped: set FAL_API_KEY or FAL_KEY in .env.local.");
    return;
  }
  if (falCircuit) {
    if (!notices.includes(falCircuit)) notices.push(falCircuit);
    console.warn(`[ppt-deck-images] fal phase skipped — ${falCircuit}`);
    return;
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
      console.log(`[ppt-deck-images] deck[${idx}] slide ${idx + 1} (${slot}) ← fal ${url.slice(0, 64)}…`);
    } else {
      console.warn(`[ppt-deck-images] deck[${idx}] slide ${idx + 1} (${slot}) — fal skipped`);
    }
  }
}

export async function generatePptDeckSlideImages(
  meta: PptDeckImageMeta,
): Promise<PptDeckImageGenerationResult> {
  const deckLen = STRUCTURED_LESSON_DECK_SLIDE_COUNT;
  const deck: (string | null)[] = Array.from({ length: deckLen }, () => null);
  const used = new Set<string>();
  const notices: string[] = [];

  const skipFalFallback =
    Boolean(getFalPptCircuitOpenReason()) || !getFalCredentials();

  console.log(
    `[ppt-deck-images] start — subject="${meta.subject}", topic="${meta.topic}", deck=${deckLen}, skipFalFallback=${skipFalFallback}`,
  );

  await runPexelsPhase(meta, deck, used, notices, skipFalFallback);
  await runFalPhase(meta, deck, used, notices);

  const pexelsCount = [0, 1, 7, 8, 9].filter((i) => Boolean(deck[i])).length;
  const got = deck.filter(Boolean).length;
  console.log(
    `[ppt-deck-images] done — ${got}/10 total slots | Pexels slides (1,2,8,9,10): ${pexelsCount}/5`,
  );
  console.log(`[ppt-deck-images] full deck URL map: ${JSON.stringify(deck.map((u) => (u ? "URL" : null)))}`);

  if (pexelsCount === 0 && !notices.some((n) => n.includes("Pexels"))) {
    notices.push(
      "No Pexels images were returned. Check server logs for [pexels] HTTP status and PEXELS_API_KEY validation.",
    );
  }

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
