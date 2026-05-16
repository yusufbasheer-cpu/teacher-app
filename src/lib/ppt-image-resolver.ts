/**
 * PPT image resolver — Pexels first, fal.ai fallback.
 *
 * For each of the 6 image slots:
 *   1. Query Pexels. If a good image is found → use it (free + fast).
 *   2. If Pexels returns null → try fal.ai for the 3 slots that support it
 *      (starter, main phase, plenary). Log the source used.
 *   3. If both fail → slot stays null; PPT still downloads successfully.
 *
 * Supported image slots and their deck indices (0-based):
 *   title          → 0
 *   starter        → 1
 *   main           → 5
 *   plenary        → 8
 *   differentiated → 9
 *   extended_task  → 10
 */

import {
  PPT_IMAGE_SLIDE_INDICES,
  buildPexelsQuery,
  fetchPexelsImage,
  type PptImageSlot,
} from "@/lib/pexels-images";
import {
  generateLessonPptSlideImages,
  type LessonPptImageSlot,
  type PptSlideImageMeta,
} from "@/lib/fal-ppt-slide-images";
import { getFalCredentials } from "@/lib/fal-flux-section-images";

/** Pexels slots that have a matching fal.ai FLUX slot as fallback. */
const FAL_SLOT_MAP: Partial<Record<PptImageSlot, LessonPptImageSlot>> = {
  starter: "starter",
  main:    "main_teaching",
  plenary: "plenary",
};

const ALL_SLOTS: PptImageSlot[] = [
  "title",
  "starter",
  "main",
  "plenary",
  "differentiated",
  "extended_task",
];

/**
 * Fetch images for all 6 PPT slots using Pexels → fal.ai fallback.
 *
 * - Runs Pexels fetches in parallel first.
 * - For any slot that returned null, falls back to fal.ai (if supported + key available).
 * - Always resolves — never throws. Missing images leave the slot null.
 *
 * Returns a full-deck-length array; only image-slot indices may be non-null.
 */
export async function fetchPptImagesWithFallback(
  topic: string,
  subject: string,
  grade: string,
  deckSize: number,
): Promise<(string | null)[]> {
  const deck: (string | null)[] = Array.from({ length: deckSize }, () => null);

  console.log(
    `[ppt-images] Starting image fetch — topic="${topic}", subject="${subject}", grade="${grade}"`,
  );

  // ── Step 1: Fetch all 6 Pexels images in parallel ──────────────────────
  const pexelsResults = await Promise.allSettled(
    ALL_SLOTS.map((slot) => {
      const query = buildPexelsQuery(slot, topic, subject);
      return fetchPexelsImage(query).then((url) => ({ slot, url, query }));
    }),
  );

  // ── Step 2: Collect Pexels hits; note which slots failed ────────────────
  const falFallbackNeeded: PptImageSlot[] = [];
  const resolvedUrls: Partial<Record<PptImageSlot, string | null>> = {};

  for (const result of pexelsResults) {
    if (result.status === "rejected") continue;
    const { slot, url } = result.value;
    const slideNum = PPT_IMAGE_SLIDE_INDICES[slot] + 1; // 1-based for logs

    if (url) {
      console.log(`[ppt-images] Using Pexels image for slide ${slideNum} (${slot})`);
      resolvedUrls[slot] = url;
    } else {
      console.log(`[ppt-images] Pexels returned no image for slide ${slideNum} (${slot})`);
      falFallbackNeeded.push(slot);
    }
  }

  // ── Step 3: fal.ai fallback for failed slots (only if key is available) ─
  const hasFalKey = Boolean(getFalCredentials());

  for (const slot of falFallbackNeeded) {
    const slideNum = PPT_IMAGE_SLIDE_INDICES[slot] + 1;
    const falSlot  = FAL_SLOT_MAP[slot];

    if (!falSlot) {
      console.log(
        `[ppt-images] Pexels failed for slide ${slideNum} (${slot}) — no fal.ai equivalent, skipping`,
      );
      resolvedUrls[slot] = null;
      continue;
    }

    if (!hasFalKey) {
      console.log(
        `[ppt-images] Pexels failed for slide ${slideNum} (${slot}) — FAL_API_KEY not set, skipping`,
      );
      resolvedUrls[slot] = null;
      continue;
    }

    console.log(
      `[ppt-images] Pexels failed for slide ${slideNum} (${slot}) — trying fal.ai fallback...`,
    );

    try {
      const meta: PptSlideImageMeta = { subject, grade, topic };
      const falResults = await generateLessonPptSlideImages(meta, [
        { slot: falSlot, slideTitle: slot, bodySnippet: "" },
      ]);
      const url = falResults[0] ?? null;

      if (url) {
        console.log(`[ppt-images] Pexels failed, using fal.ai for slide ${slideNum} (${slot})`);
        resolvedUrls[slot] = url;
      } else {
        console.log(
          `[ppt-images] Both Pexels and fal.ai failed for slide ${slideNum} (${slot}) — skipping`,
        );
        resolvedUrls[slot] = null;
      }
    } catch (err) {
      console.error(
        `[ppt-images] fal.ai error for slide ${slideNum} (${slot}) — skipping`,
        err,
      );
      resolvedUrls[slot] = null;
    }
  }

  // ── Step 4: Place resolved URLs at correct deck indices ─────────────────
  for (const slot of ALL_SLOTS) {
    const idx = PPT_IMAGE_SLIDE_INDICES[slot];
    if (idx < deckSize) {
      deck[idx] = resolvedUrls[slot] ?? null;
    }
  }

  const found = ALL_SLOTS.filter((s) => resolvedUrls[s]).length;
  console.log(`[ppt-images] ${found}/${ALL_SLOTS.length} images resolved for PPT deck`);

  return deck;
}
