import { ApiError, createFalClient } from "@fal-ai/client";
import {
  FAL_BALANCE_EXHAUSTED_USER_MESSAGE,
  FAL_FLUX_MODEL_ID,
  formatFalError,
  getFalCredentials,
  isFalAccountLockedError,
} from "@/lib/fal-flux-section-images";

/** Same model as section FLUX images (reliable on fal.ai accounts with balance). */
export const FAL_PPT_IMAGE_MODEL_ID = FAL_FLUX_MODEL_ID;

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
  | "fallback_pexels_extended"
  /** Slide 1 when Pexels fails — short educational background prompt. */
  | "title_slide_fal_fallback";

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
      core =
        "SDG sustainable development goals colorful icons education flat design clean background no humans no faces";
      break;
    case "main_teaching":
      core = `Detailed educational diagram explaining the specific topic "${topic}" for ${grade} ${subject}. Flat design, colorful, clean white background`;
      break;
    case "differentiated_activity":
      core = `Learning levels illustration with three distinct tiers for differentiated tasks about "${topic}" in ${subject}. Flat design, colorful, symbolic stepped layers`;
      break;
    case "exit_ticket":
      core =
        "simple quiz assessment illustration with question marks checkboxes and pencil icons flat design teal color clean white background no humans no faces";
      break;
    case "success_criteria":
      core =
        "achievement stars checkmarks trophy icons flat design colorful clean white background no humans no faces";
      break;
    case "title_slide_fal_fallback":
      core = `colorful educational background related to ${subject} and ${topic}, flat design, no humans, no faces, Islamic appropriate`;
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

const FAL_IMAGE_TIMEOUT_MS = 90_000;

let falPptCircuitOpenReason: string | null = null;

export function getFalPptCircuitOpenReason(): string | null {
  return falPptCircuitOpenReason;
}

export function resetFalPptCircuitForTests(): void {
  falPptCircuitOpenReason = null;
}

export type FalPptImageCallOptions = {
  /** Log full subscribe payload (truncated) for debugging failed slides. */
  verboseLog?: boolean;
  logLabel?: string;
};

function safeJsonForLog(value: unknown, maxLen = 12_000): string {
  try {
    const s = JSON.stringify(value, null, 2);
    return s.length > maxLen ? `${s.slice(0, maxLen)}… (truncated)` : s;
  } catch {
    return String(value);
  }
}

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
export async function generateFalPptImageFromPrompt(
  fullPrompt: string,
  callOptions?: FalPptImageCallOptions,
): Promise<string | null> {
  const label = callOptions?.logLabel ?? "fal-ppt";
  if (falPptCircuitOpenReason) {
    console.warn(`[fal-ppt][${label}] skipped — ${falPptCircuitOpenReason}`);
    return null;
  }

  const credentials = getFalCredentials();
  if (!credentials) {
    console.warn(`[fal-ppt][${label}] skipped — no FAL_API_KEY / FAL_KEY`);
    return null;
  }

  const client = createFalClient({ credentials });
  try {
    const input = {
      prompt: fullPrompt,
      image_size: PPT_IMAGE_SIZE,
      num_images: 1,
      num_inference_steps: PPT_NUM_INFERENCE_STEPS,
      guidance_scale: PPT_GUIDANCE_SCALE,
      enable_safety_checker: true,
      output_format: "png" as const,
    };

    console.log(`[fal-ppt][${label}] request model=${FAL_PPT_IMAGE_MODEL_ID} promptChars=${fullPrompt.length}`);

    const subscribePromise = client.subscribe(FAL_PPT_IMAGE_MODEL_ID, { input });

    const result = await withTimeout(
      subscribePromise as Promise<{ data?: { images?: { url?: string }[] }; error?: unknown }>,
      FAL_IMAGE_TIMEOUT_MS,
      `fal-ppt:${label}`,
    );

    if (callOptions?.verboseLog) {
      console.log(`[fal-ppt][${label}] image generated (response logged server-side only)`);
    }

    if (result === null) {
      console.error(`[fal-ppt][${label}] FAILED: timed out after ${FAL_IMAGE_TIMEOUT_MS}ms (no payload)`);
      return null;
    }

    const url = result?.data?.images?.[0]?.url;
    if (typeof url === "string" && url.length > 0) {
      console.log(`[fal-ppt][${label}] OK image URL: ${url.slice(0, 120)}…`);
      return url;
    }

    console.error(
      `[fal-ppt][${label}] FAILED: missing images[0].url in response. data snapshot:`,
      safeJsonForLog(result?.data ?? result, 4000),
    );
    return null;
  } catch (e) {
    if (isFalAccountLockedError(e)) {
      falPptCircuitOpenReason = FAL_BALANCE_EXHAUSTED_USER_MESSAGE;
      console.error(`[fal-ppt][${label}] FAILED: ${FAL_BALANCE_EXHAUSTED_USER_MESSAGE}`);
    } else {
      console.error(`[fal-ppt][${label}] FAILED: exception`, formatFalError(e), e);
      if (e instanceof ApiError) {
        console.error(`[fal-ppt][${label}] HTTP ${e.status} body:`, JSON.stringify(e.body).slice(0, 500));
      }
    }
    return null;
  }
}

/** Generate one deck image; retries once with “variant” if URL duplicates `usedUrls`. */
export async function generateLessonPptFluxImageDeduped(
  meta: PptSlideImageMeta,
  slot: LessonPptFluxSlot,
  usedUrls: Set<string>,
  callOptions?: FalPptImageCallOptions,
): Promise<string | null> {
  let prompt = buildLessonPptFluxPrompt(meta, slot);
  const label = callOptions?.logLabel ?? `slot:${slot}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1) {
      prompt = `${prompt} Alternate composition and layout variant B, different arrangement of elements.`;
    }
    const url = await generateFalPptImageFromPrompt(prompt, {
      ...callOptions,
      logLabel: attempt === 0 ? label : `${label}-retry`,
    });
    if (!url) return null;
    if (!usedUrls.has(url)) return url;
    console.warn(`[fal-ppt][${label}] duplicate URL from fal — retrying variant if attempts remain`);
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
