/**
 * Pexels image fetching utility for Layah.ai PPT generation.
 *
 * Used in two places:
 *  1. /api/get-image route  (external callers)
 *  2. /api/lesson-plan/export/pptx route  (direct server call, no extra round-trip)
 */

import { createClient } from "pexels";

/** Slide types that get a Pexels image in the PPT. */
export type PptImageSlot = "title" | "main" | "plenary";

/** Slide indices that receive images: 0 = title, 5 = main phase, 8 = plenary. */
export const PPT_IMAGE_SLIDE_INDICES: Record<PptImageSlot, number> = {
  title:   0,
  main:    5,
  plenary: 8,
};

/**
 * Build a focused Pexels search query from lesson metadata.
 * Keeps it specific so results are actually relevant to the lesson.
 */
export function buildPexelsQuery(
  slot: PptImageSlot,
  topic: string,
  subject: string,
): string {
  const t = topic.trim();
  const s = subject.trim();
  switch (slot) {
    case "title":
      return `${t} ${s} education`;
    case "main":
      return `${t} ${s} learning classroom`;
    case "plenary":
      return `${t} ${s} knowledge`;
    default:
      return `${t} education`;
  }
}

/**
 * Fetch a single landscape photo URL from Pexels.
 * Returns null on any failure — never throws.
 */
export async function fetchPexelsImage(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY?.trim();
  if (!apiKey) {
    console.log("[pexels] PEXELS_API_KEY not set — skipping image fetch");
    return null;
  }

  try {
    const client = createClient(apiKey);
    const result = await client.photos.search({
      query,
      per_page: 1,
      orientation: "landscape",
    });

    if ("error" in result) {
      console.error("[pexels] API error:", result.error);
      return null;
    }

    const photo = result.photos[0];
    if (!photo) {
      console.log(`[pexels] No results for query: "${query}"`);
      return null;
    }

    // Prefer large (1280px wide) for PPT quality; fall back to medium
    const url = photo.src.large ?? photo.src.medium ?? null;
    console.log(`[pexels] Image found for "${query}": ${url?.slice(0, 80)}`);
    return url;
  } catch (e) {
    console.error("[pexels] fetchPexelsImage failed:", e);
    return null;
  }
}

/**
 * Fetch images for all three PPT slots in parallel.
 * Any slot that fails resolves to null — PPT always downloads.
 *
 * Returns an array of length `deckSize` where only indices
 * 0, 5, 8 may be non-null.
 */
export async function fetchPptPexelsImages(
  topic: string,
  subject: string,
  deckSize: number,
): Promise<(string | null)[]> {
  const slots: PptImageSlot[] = ["title", "main", "plenary"];

  console.log(`[pexels] Fetching ${slots.length} PPT images for topic="${topic}", subject="${subject}"`);

  const results = await Promise.allSettled(
    slots.map((slot) => {
      const query = buildPexelsQuery(slot, topic, subject);
      console.log(`[pexels] Slot "${slot}" query: "${query}"`);
      return fetchPexelsImage(query);
    }),
  );

  const urls = results.map((r) => (r.status === "fulfilled" ? r.value : null));

  // Map into a full-deck array (null for slides with no image)
  const deck: (string | null)[] = Array.from({ length: deckSize }, () => null);
  const slideIndices = [
    PPT_IMAGE_SLIDE_INDICES.title,
    PPT_IMAGE_SLIDE_INDICES.main,
    PPT_IMAGE_SLIDE_INDICES.plenary,
  ];
  slideIndices.forEach((slideIdx, i) => {
    if (slideIdx < deckSize) {
      deck[slideIdx] = urls[i] ?? null;
    }
  });

  const found = urls.filter(Boolean).length;
  console.log(`[pexels] ${found}/${slots.length} images fetched successfully`);
  return deck;
}
