import { createFalClient } from "@fal-ai/client";
import { formatFalError, getFalCredentials } from "@/lib/fal-flux-section-images";

/** Lesson PPT export uses FLUX Pro (higher quality than dev). Section images may still use dev elsewhere. */
export const FAL_PPT_IMAGE_MODEL_ID = "fal-ai/flux-pro" as const;

/** Always appended: rectangular landscape framing (never circular crop). */
const LANDSCAPE_RECT_SUFFIX =
  "rectangular landscape 16:9 composition, full rectangular frame, no circular crop, no round frame, no vignette circle, school suitable";

export type PptSlideImageMeta = {
  subject: string;
  grade: string;
  topic: string;
};

/**
 * fal.ai is used for illustration-based PPT slides:
 *   Index 2  – Chapter / SDG Goal
 *   Index 5  – Main Phase Core Teaching
 *   Index 6  – Differentiated Activity
 *   Index 10 – Exit Ticket
 *   Index 11 – Success Criteria Self Evaluation
 */
export type LessonPptImageSlot =
  | "sdg_chapter"
  | "main_teaching"
  | "differentiated"
  | "exit_ticket"
  | "success_criteria";

export type LessonPptImageGenerationSpec = {
  slot: LessonPptImageSlot;
  /** Retained for logging / future use; prompts are template-based on subject, grade, topic only. */
  slideTitle: string;
  bodySnippet: string;
};

function sanitizePhrase(s: string): string {
  return s.replace(/\s+/g, " ").trim() || "lesson";
}

/** Shared safety suffix appended to every fal.ai prompt. */
const SAFE_SUFFIX =
  "no human figures, no faces, no people, Islamic appropriate, school suitable, professional educational illustration";

/**
 * Fixed prompt templates per slide type.
 * Each prompt is tailored to produce a relevant illustration for that slide's purpose.
 */
export function buildLessonPptFluxPrompt(meta: PptSlideImageMeta, spec: LessonPptImageGenerationSpec): string {
  const subject = sanitizePhrase(meta.subject);
  const topic   = sanitizePhrase(meta.topic);

  let core: string;
  switch (spec.slot) {
    case "sdg_chapter":
      core = `SDG sustainable development goal icon combined with educational illustration for ${topic} in ${subject}, colorful SDG color palette, globe and knowledge symbols, flat design, clean white background`;
      break;
    case "main_teaching":
      core = `detailed educational diagram explaining ${topic} in ${subject}, step-by-step visual breakdown, labeled arrows showing process, flat design, professional, colorful, clean white background`;
      break;
    case "differentiated":
      core = `learning levels illustration showing three tiers of tasks for ${topic}, foundation core and extension icons, stacked layers concept, flat design, colorful icons, clean background`;
      break;
    case "exit_ticket":
      core = `assessment and quiz graphic with question marks, checkboxes, pencil and evaluation icons for ${topic}, teal and navy color scheme, flat design, clean background`;
      break;
    case "success_criteria":
      core = `achievement and checklist illustration with stars, checkmarks, progress bar and trophy icons for ${topic}, flat design, colorful, clean background`;
      break;
    default:
      core = `professional educational illustration for ${topic} in ${subject}, flat design, colorful, clean background`;
  }

  return `${core}, ${SAFE_SUFFIX}, ${LANDSCAPE_RECT_SUFFIX}`;
}

const PPT_IMAGE_SIZE = "landscape_16_9" as const;
const PPT_NUM_INFERENCE_STEPS = 28;
const PPT_GUIDANCE_SCALE = 7.5;

/** How long (ms) to wait for a single fal.ai image before skipping it. */
const FAL_IMAGE_TIMEOUT_MS = 20_000;

/**
 * Race a promise against a timeout.
 * Resolves to null if the timeout fires first — never throws.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[fal-ppt] ${label} timed out after ${ms}ms — skipping`);
      resolve(null);
    }, ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    return result;
  } catch (e) {
    return null;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/** Generates FLUX Pro images for lesson PPT illustration slides (sdg_chapter, main_teaching, differentiated, exit_ticket, success_criteria). */
export async function generateLessonPptSlideImages(
  meta: PptSlideImageMeta,
  specs: LessonPptImageGenerationSpec[],
): Promise<(string | null)[]> {
  if (specs.length === 0) return [];
  const credentials = getFalCredentials();
  if (!credentials) {
    console.log("[fal-ppt] no FAL_API_KEY/FAL_KEY — exporting PPT without slide images");
    return specs.map(() => null);
  }

  const client = createFalClient({ credentials });
  const out: (string | null)[] = [];

  console.log(
    "[fal-ppt] generating",
    specs.length,
    "lesson PPT image(s), model:",
    FAL_PPT_IMAGE_MODEL_ID,
    "image_size:",
    PPT_IMAGE_SIZE,
    `timeout: ${FAL_IMAGE_TIMEOUT_MS}ms each`,
  );

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]!;
    const n = i + 1;
    try {
      const prompt = buildLessonPptFluxPrompt(meta, spec);
      console.log("[fal-ppt] exact prompt for fal.ai", {
        index: n,
        total: specs.length,
        slot: spec.slot,
        prompt,
      });

      const subscribePromise = client.subscribe(FAL_PPT_IMAGE_MODEL_ID, {
        input: {
          prompt,
          image_size: PPT_IMAGE_SIZE,
          num_images: 1,
          num_inference_steps: PPT_NUM_INFERENCE_STEPS,
          guidance_scale: PPT_GUIDANCE_SCALE,
          enable_safety_checker: true,
          output_format: "png",
        },
      });

      const result = await withTimeout(
        subscribePromise as Promise<typeof subscribePromise extends Promise<infer R> ? R : never>,
        FAL_IMAGE_TIMEOUT_MS,
        `image ${n}/${specs.length} (slot: ${spec.slot})`,
      );

      if (!result) {
        // Timed out — continue without this image, never block the PPT
        out.push(null);
        continue;
      }

      const url = result.data?.images?.[0]?.url;
      if (typeof url === "string" && url.length > 0) {
        out.push(url);
        console.log("[fal-ppt] image", n, "/", specs.length, "ok", { slot: spec.slot });
      } else {
        out.push(null);
        console.error(
          "[fal-ppt] image",
          n,
          "no URL in response; data:",
          JSON.stringify(result.data).slice(0, 500),
        );
      }
    } catch (e) {
      // Any error → skip image and keep going
      out.push(null);
      const formatted = formatFalError(e);
      const raw = e instanceof Error ? e.message : String(e);
      console.error("[fal-ppt] image", n, "/", specs.length, "failed — skipping.", {
        slot: spec.slot,
        formatFalError: formatted,
        message: raw,
      });
    }
  }

  return out;
}
