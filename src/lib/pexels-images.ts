/**
 * Pexels image fetching for Layah.ai PPT generation.
 *
 * Pexels is used for slides that benefit from real photography:
 *   Index 0  – Title Slide                      (subject + topic + education background)
 *   Index 1  – Starter Activity                 (curiosity discovery thinking students)
 *   Index 7  – UAE Real Life Cross Curricular   (UAE Dubai landmark real life topic connection)
 *   Index 8  – Plenary                          (reflection classroom learning summary)
 *   Index 9  – Extended Task                    (research study homework independent learning)
 *
 * fal.ai handles illustration-based slides (main phase, differentiated, exit ticket,
 * success criteria, SDG chapter) — see ppt-image-resolver.ts.
 */

import { createClient } from "pexels";

/** The 5 PPT slide types that receive a Pexels photo. */
export type PptPexelsSlot =
  | "title"
  | "starter"
  | "uae_link"
  | "plenary"
  | "extended_task";

/** Deck index for each Pexels slot. */
export const PEXELS_SLIDE_INDICES: Record<PptPexelsSlot, number> = {
  title:        0,
  starter:      1,
  uae_link:     7,
  plenary:      8,
  extended_task: 9,
};

/**
 * Build a focused Pexels search query for each slot.
 * Queries are intentionally broad so Pexels can return high-quality photos.
 */
export function buildPexelsQuery(
  slot: PptPexelsSlot,
  topic: string,
  subject: string,
): string {
  const t = topic.trim();
  const s = subject.trim();
  switch (slot) {
    case "title":
      return `${s} ${t} education background`;
    case "starter":
      return "curiosity discovery thinking students";
    case "uae_link":
      return `UAE Dubai landmark real life ${t} connection`;
    case "plenary":
      return "reflection classroom learning summary";
    case "extended_task":
      return "research study homework independent learning";
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
      per_page: 3,
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

    const url = photo.src.large2x ?? photo.src.large ?? photo.src.medium ?? null;
    console.log(`[pexels] ✔ "${query}" → ${url?.slice(0, 80)}`);
    return url;
  } catch (e) {
    console.error("[pexels] fetchPexelsImage failed for query:", query, e);
    return null;
  }
}
