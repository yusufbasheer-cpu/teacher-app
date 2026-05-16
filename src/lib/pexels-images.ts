/**
 * Pexels image fetching utility for Layah.ai PPT generation.
 *
 * 6 slides receive images (text left, image right — no overlap):
 *   Index 0  – Title Slide
 *   Index 1  – Starter Activity
 *   Index 5  – Main Phase
 *   Index 8  – Plenary
 *   Index 9  – Differentiated Activity
 *   Index 10 – Extended Task / Exit Ticket
 */

import { createClient } from "pexels";

/** The 6 PPT slide types that receive a Pexels image. */
export type PptImageSlot =
  | "title"
  | "starter"
  | "main"
  | "plenary"
  | "differentiated"
  | "extended_task";

/** Deck index for each image slot. */
export const PPT_IMAGE_SLIDE_INDICES: Record<PptImageSlot, number> = {
  title:          0,
  starter:        1,
  main:           5,
  plenary:        8,
  differentiated: 9,
  extended_task:  10,
};

/**
 * Build a focused, topic-specific Pexels search query for each slot.
 * Keep queries concrete so results are visually relevant.
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
      // Broad hero image for the topic
      return `${t} ${s}`;
    case "starter":
      // Curiosity / discovery feel for engaging openers
      return `${t} ${s} discovery curiosity`;
    case "main":
      // Educational / instructional content
      return `${t} ${s} learning education`;
    case "plenary":
      // Reflection / summary feel
      return `${t} ${s} reflection summary`;
    case "differentiated":
      // Collaborative / group activity
      return `${t} classroom activity teamwork`;
    case "extended_task":
      // Independent / homework / study
      return `${t} ${s} study research`;
    default:
      return `${t} education`;
  }
}

/**
 * Fetch a single landscape photo URL from Pexels.
 * Returns null on any failure — never throws.
 */
/**
 * Search Pexels (landscape) across pages until an unused image URL is found.
 * Returns null if API missing, no results, or all candidates already used.
 */
export async function fetchPexelsUniqueLandscapeUrl(
  query: string,
  usedUrls: Set<string>,
): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY?.trim();
  if (!apiKey) {
    console.log("[pexels] PEXELS_API_KEY not set — skipping image fetch");
    return null;
  }

  try {
    const client = createClient(apiKey);
    const q = query.replace(/\s+/g, " ").trim() || "education";

    for (let page = 1; page <= 10; page++) {
      const result = await client.photos.search({
        query: q,
        per_page: 15,
        page,
        orientation: "landscape",
      });

      if ("error" in result) {
        console.error("[pexels] API error:", (result as { error: string }).error);
        break;
      }

      for (const photo of result.photos) {
        const url = photo.src.large ?? photo.src.medium ?? null;
        if (url && !usedUrls.has(url)) {
          console.log(`[pexels] ✔ unique landscape hit page ${page}: ${url.slice(0, 90)}…`);
          return url;
        }
      }

      if (result.photos.length === 0) break;
    }

    console.log(`[pexels] No unused landscape image for query: "${q}"`);
    return null;
  } catch (e) {
    console.error("[pexels] fetchPexelsUniqueLandscapeUrl failed for query:", query, e);
    return null;
  }
}

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
      console.error("[pexels] API error:", (result as { error: string }).error);
      return null;
    }

    const photo = result.photos[0];
    if (!photo) {
      console.log(`[pexels] No results for query: "${query}"`);
      return null;
    }

    // Prefer large (1280 px wide) for crisp PPT rendering; fall back to medium
    const url = photo.src.large ?? photo.src.medium ?? null;
    console.log(`[pexels] ✔ Image for "${query}": ${url?.slice(0, 90)}`);
    return url;
  } catch (e) {
    console.error("[pexels] fetchPexelsImage failed for query:", query, e);
    return null;
  }
}

/**
 * Fetch all 6 PPT slot images in parallel.
 * Any individual failure resolves to null — the PPT always downloads.
 *
 * Returns a full-deck-length array where only the 6 image slot indices
 * may be non-null (0, 1, 5, 8, 9, 10).
 */
export async function fetchPptPexelsImages(
  topic: string,
  subject: string,
  deckSize: number,
): Promise<(string | null)[]> {
  const slots: PptImageSlot[] = [
    "title",
    "starter",
    "main",
    "plenary",
    "differentiated",
    "extended_task",
  ];

  console.log(
    `[pexels] Fetching ${slots.length} PPT images — topic="${topic}", subject="${subject}"`,
  );

  // Fire all requests in parallel; allSettled ensures one failure doesn't abort others
  const results = await Promise.allSettled(
    slots.map((slot) => {
      const query = buildPexelsQuery(slot, topic, subject);
      console.log(`[pexels] Slot "${slot}" → query: "${query}"`);
      return fetchPexelsImage(query);
    }),
  );

  const urls = results.map((r) => (r.status === "fulfilled" ? r.value : null));

  // Place each URL at its correct deck index; all other indices remain null
  const deck: (string | null)[] = Array.from({ length: deckSize }, () => null);
  slots.forEach((slot, i) => {
    const idx = PPT_IMAGE_SLIDE_INDICES[slot];
    if (idx < deckSize) {
      deck[idx] = urls[i] ?? null;
    }
  });

  const found = urls.filter(Boolean).length;
  console.log(`[pexels] ${found}/${slots.length} images fetched successfully`);
  return deck;
}
