import { createFalClient } from "@fal-ai/client";
import { formatFalError, getFalCredentials } from "@/lib/fal-flux-section-images";

/** Lesson PPT export uses FLUX Pro for crisp diagrams. */
export const FAL_PPT_IMAGE_MODEL_ID = "fal-ai/flux-pro" as const;

export type PptSlideImageMeta = {
  subject: string;
  grade: string;
  topic: string;
};

/** Mandatory wording for every fal PPT image (user requirement). */
export const FAL_PPT_SAFETY_SUFFIX =
  "no human figures, no faces, Islamic appropriate, school suitable";

const LANDSCAPE_RECT =
  "rectangular landscape 16:9 composition, full rectangular frame, no circular crop, no round frame, no vignette circle";

/** Primary fal slots for the structured 13-slide deck. */
export type LessonPptFluxSlot =
  | "sdg_chapter"
  | "main_teaching"
  | "differentiated_activity"
  | "exit_ticket"
  | "success_criteria"
  /** When Pexels fails on a photo slide, fal generates a non-duplicate illustration instead. */
  | "fallback_pexels_title"
  | "fallback_pexels_starter"
  | "fallback_pexels_uae"
  | "fallback_pexels_plenary"
  | "fallback_pexels_extended";

export type LessonPptImageGenerationSpec = {
  slot: LessonPptFluxSlot;
  slideTitle: string;
  bodySnippet: string;
};

function sanitizePhrase(s: string): string {
  return s.replace(/\s+/g, " ").trim() || "lesson";
}

export function buildLessonPptFluxPrompt(meta: PptSlideImageMeta, slot: LessonPptFluxSlot): string {
  const subject = sanitizePhrase(meta.subject);
  const grade = sanitizePhrase(meta.grade);
  const topic = sanitizePhrase(meta.topic);

  let core: string;
  switch (slot) {
    case "sdg_chapter":
      core = `SDG sustainable development goal iconography and topic illustration for "${topic}" in ${subject}. Flat design, UN SDG colour palette feel, symbolic icons and geometric shapes only`;
      break;
    case "main_teaching":
      core = `Detailed educational diagram explaining the specific topic "${topic}" for ${grade} ${subject}. Flat design, colorful, clean white background`;
      break;
    case "differentiated_activity":
      core = `Learning levels illustration with three distinct tiers for differentiated tasks about "${topic}" in ${subject}. Flat design, colorful, symbolic stepped layers`;
      break;
    case "exit_ticket":
      core = `Assessment and quiz graphic with checkboxes and question marks for "${topic}" in ${subject}. Flat design, teal and navy colors`;
      break;
    case "success_criteria":
      core = `Achievement and checklist illustration with stars and checkmarks for "${topic}" in ${subject}. Flat design, colorful`;
      break;
    case "fallback_pexels_title":
      core = `Abstract education hero background for "${topic}" in ${subject}: books, geometric shapes, soft gradient, classroom-ready banner, no text`;
      break;
    case "fallback_pexels_starter":
      core = `Curiosity and discovery learning illustration: lightbulbs, question marks, magnifying glass motifs for "${topic}". Flat vector educational poster`;
      break;
    case "fallback_pexels_uae":
      core = `UAE and Dubai themed abstract illustration symbolic of real-world links to "${topic}", geometric landmarks silhouette hints, modern Gulf aesthetic`;
      break;
    case "fallback_pexels_plenary":
      core = `Reflection and classroom summary graphic for "${topic}" in ${subject}: journal icons, recap arrows, calm classroom palette`;
      break;
    case "fallback_pexels_extended":
      core = `Research homework and independent study graphic for "${topic}" in ${subject}: notebook, laptop silhouette as object only, study desk flat lay`;
      break;
    default:
      core = `Professional educational illustration for "${topic}", flat design`;
  }

  return `${core}. ${FAL_PPT_SAFETY_SUFFIX}, ${LANDSCAPE_RECT}`;
}

const PPT_IMAGE_SIZE = "landscape_16_9" as const;
const PPT_NUM_INFERENCE_STEPS = 28;
const PPT_GUIDANCE_SCALE = 7.5;

const FAL_IMAGE_TIMEOUT_MS = 25_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[fal-ppt] ${label} timed out after ${ms}ms — skipping`);
      resolve(null);
    }, ms);
  });
  try {
    return (await Promise.race([promise, timeout])) as T | null;
  } catch {
    return null;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/**
 * Single fal.ai FLUX image from a full prompt string (already includes safety + landscape).
 */
export async function generateFalPptImageFromPrompt(fullPrompt: string): Promise<string | null> {
  const credentials = getFalCredentials();
  if (!credentials) return null;

  const client = createFalClient({ credentials });
  try {
    const subscribePromise = client.subscribe(FAL_PPT_IMAGE_MODEL_ID, {
      input: {
        prompt: fullPrompt,
        image_size: PPT_IMAGE_SIZE,
        num_images: 1,
        num_inference_steps: PPT_NUM_INFERENCE_STEPS,
        guidance_scale: PPT_GUIDANCE_SCALE,
        enable_safety_checker: true,
        output_format: "png",
      },
    });

    const result = await withTimeout(subscribePromise as Promise<{ data?: { images?: { url?: string }[] } }>, FAL_IMAGE_TIMEOUT_MS, "single fal ppt image");

    const url = result?.data?.images?.[0]?.url;
    return typeof url === "string" && url.length > 0 ? url : null;
  } catch (e) {
    console.error("[fal-ppt] generateFalPptImageFromPrompt failed:", formatFalError(e));
    return null;
  }
}

/** Generate one deck image; retries once with “variant” if URL duplicates `usedUrls`. */
export async function generateLessonPptFluxImageDeduped(
  meta: PptSlideImageMeta,
  slot: LessonPptFluxSlot,
  usedUrls: Set<string>,
): Promise<string | null> {
  let prompt = buildLessonPptFluxPrompt(meta, slot);
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1) {
      prompt = `${prompt} Alternate composition and layout variant B, different arrangement of elements.`;
    }
    const url = await generateFalPptImageFromPrompt(prompt);
    if (!url) return null;
    if (!usedUrls.has(url)) return url;
    console.warn("[fal-ppt] duplicate URL from fal — retrying variant if attempts remain");
  }
  return null;
}

/** @deprecated Prefer {@link generateLessonPptFluxImageDeduped} per slot. */
export async function generateLessonPptSlideImages(
  meta: PptSlideImageMeta,
  specs: LessonPptImageGenerationSpec[],
): Promise<(string | null)[]> {
  const used = new Set<string>();
  const out: (string | null)[] = [];
  for (const spec of specs) {
    const url = await generateLessonPptFluxImageDeduped(meta, spec.slot, used);
    out.push(url);
    if (url) used.add(url);
  }
  return out;
}
