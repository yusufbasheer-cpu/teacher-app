/**
 * PPT image resolver — split-source strategy.
 *
 * PEXELS handles photography slides (real environments, real contexts):
 *   Index 0  – Title Slide               → "{subject} {topic} education background"
 *   Index 1  – Starter Activity          → "curiosity discovery thinking students"
 *   Index 7  – UAE Real Life Link        → "UAE Dubai landmark real life {topic} connection"
 *   Index 8  – Plenary                   → "reflection classroom learning summary"
 *   Index 9  – Extended Task             → "research study homework independent learning"
 *
 * FAL.AI handles illustration slides (custom diagrams / icons):
 *   Index 2  – Chapter & SDG Goal        → SDG icons + topic illustration
 *   Index 5  – Main Phase Core Teaching  → educational diagram for the topic
 *   Index 6  – Differentiated Activity   → three-tier learning levels illustration
 *   Index 10 – Exit Ticket               → quiz/assessment graphic
 *   Index 11 – Success Criteria          → achievement/checklist illustration
 *
 * Fallback rules:
 *   • If Pexels fails for a Pexels slot  → try fal.ai for that slot (if key available)
 *   • If fal.ai fails for a fal.ai slot  → skip image (slot stays null)
 *   • PPT always downloads — images are never blocking
 */

import {
  PEXELS_SLIDE_INDICES,
  buildPexelsQuery,
  fetchPexelsImage,
  type PptPexelsSlot,
} from "@/lib/pexels-images";
import {
  generateLessonPptSlideImages,
  type LessonPptImageSlot,
  type PptSlideImageMeta,
} from "@/lib/fal-ppt-slide-images";
import { getFalCredentials } from "@/lib/fal-flux-section-images";

// ── Pexels slots ─────────────────────────────────────────────────────────────
const PEXELS_SLOTS: PptPexelsSlot[] = [
  "title",
  "starter",
  "uae_link",
  "plenary",
  "extended_task",
];

// ── fal.ai slots ─────────────────────────────────────────────────────────────
type FalSlotConfig = {
  slot: LessonPptImageSlot;
  deckIndex: number;
};

const FAL_SLOTS: FalSlotConfig[] = [
  { slot: "sdg_chapter",     deckIndex: 2  },
  { slot: "main_teaching",   deckIndex: 5  },
  { slot: "differentiated",  deckIndex: 6  },
  { slot: "exit_ticket",     deckIndex: 10 },
  { slot: "success_criteria", deckIndex: 11 },
];

/** Pexels slots that can fall back to fal.ai if photography fails. */
const PEXELS_FAL_FALLBACK: Partial<Record<PptPexelsSlot, LessonPptImageSlot>> = {
  // No Pexels→fal.ai fallbacks for photography slots by default —
  // photography and illustrations have different aesthetics.
  // Add mappings here if you want fallbacks for specific slots.
};

// ── Main resolver ─────────────────────────────────────────────────────────────
/**
 * Fetch all PPT slide images using the split-source strategy.
 * Returns a full-deck-length array; slots without images stay null.
 * Never throws — failures are logged and skipped gracefully.
 */
export async function fetchPptImagesWithFallback(
  topic: string,
  subject: string,
  grade: string,
  deckSize: number,
): Promise<(string | null)[]> {
  const deck: (string | null)[] = Array.from({ length: deckSize }, () => null);
  const meta: PptSlideImageMeta = { subject, grade, topic };
  const hasFalKey = Boolean(getFalCredentials());

  console.log(
    `[ppt-images] Fetching images — topic="${topic}", subject="${subject}", ` +
    `pexels=${PEXELS_SLOTS.length} slots, fal.ai=${FAL_SLOTS.length} slots`,
  );

  // ── Step 1: Pexels photography slots (parallel) ───────────────────────────
    const pexelsResults = await Promise.allSettled(
    PEXELS_SLOTS.map(async (slot) => {
      const query = buildPexelsQuery(slot, topic, subject);
      const deckIdx = PEXELS_SLIDE_INDICES[slot];
      const slideNum = deckIdx + 1;
      console.log(`IMAGE GENERATION STARTED for slide ${slideNum} (${slot}) — source: Pexels — query: "${query}"`);

      const url = await fetchPexelsImage(query);

      if (url) {
        console.log(`[ppt-images] ✔ Using Pexels image for slide ${slideNum} (${slot})`);
        return { slot, deckIdx, url };
      }

      // Pexels failed — try fal.ai fallback if configured
      const falFallback = PEXELS_FAL_FALLBACK[slot];
      if (falFallback && hasFalKey) {
        console.log(`[ppt-images] Pexels failed for slide ${slideNum} (${slot}) — trying fal.ai fallback…`);
        try {
          const [falUrl] = await generateLessonPptSlideImages(meta, [
            { slot: falFallback, slideTitle: slot, bodySnippet: "" },
          ]);
          if (falUrl) {
            console.log(`[ppt-images] ✔ fal.ai fallback succeeded for slide ${slideNum} (${slot})`);
            return { slot, deckIdx, url: falUrl };
          }
        } catch {
          /* ignore */
        }
      }

      console.log(`[ppt-images] No image for slide ${slideNum} (${slot}) — skipping`);
      return { slot, deckIdx, url: null };
    }),
  );

  for (const r of pexelsResults) {
    if (r.status === "fulfilled" && r.value.url && r.value.deckIdx < deckSize) {
      deck[r.value.deckIdx] = r.value.url;
    }
  }

  // ── Step 2: fal.ai illustration slots (sequential — API rate limits) ───────
  if (hasFalKey) {
    const falSpecs = FAL_SLOTS.map(({ slot }) => ({
      slot,
      slideTitle: slot,
      bodySnippet: "",
    }));

    FAL_SLOTS.forEach(({ slot, deckIndex }) => {
      console.log(`IMAGE GENERATION STARTED for slide ${deckIndex + 1} (${slot}) — source: fal.ai`);
    });
    console.log(`[ppt-images] Generating ${falSpecs.length} fal.ai illustration images…`);

    let falUrls: (string | null)[] = [];
    try {
      falUrls = await generateLessonPptSlideImages(meta, falSpecs);
    } catch (err) {
      console.error("[ppt-images] fal.ai batch failed — skipping all fal.ai images", err);
      falUrls = FAL_SLOTS.map(() => null);
    }

    FAL_SLOTS.forEach(({ slot, deckIndex }, i) => {
      const slideNum = deckIndex + 1;
      const url = falUrls[i] ?? null;
      if (url && deckIndex < deckSize) {
        console.log(`[ppt-images] ✔ fal.ai image for slide ${slideNum} (${slot})`);
        deck[deckIndex] = url;
      } else {
        console.log(`[ppt-images] No fal.ai image for slide ${slideNum} (${slot}) — skipping`);
      }
    });
  } else {
    console.log("[ppt-images] FAL_API_KEY not set — skipping all fal.ai illustration slots");
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = PEXELS_SLOTS.length + FAL_SLOTS.length;
  const found = deck.filter(Boolean).length;
  console.log(`[ppt-images] ${found}/${total} images resolved for PPT deck`);

  return deck;
}
