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

/** Three PPT slide types with FLUX images: slides 2, 6, 9 → indices 1, 5, 8. Slide 1 has no image. */
export type LessonPptImageSlot = "starter" | "main_teaching" | "plenary";

export type LessonPptImageGenerationSpec = {
  slot: LessonPptImageSlot;
  /** Retained for logging / future use; prompts are template-based on subject, grade, topic only. */
  slideTitle: string;
  bodySnippet: string;
};

function sanitizePhrase(s: string): string {
  return s.replace(/\s+/g, " ").trim() || "lesson";
}

/**
 * Fixed prompt templates per slide type (subject / grade / topic from teacher input only).
 */
export function buildLessonPptFluxPrompt(meta: PptSlideImageMeta, spec: LessonPptImageGenerationSpec): string {
  const subject = sanitizePhrase(meta.subject);
  const grade = sanitizePhrase(meta.grade);
  const topic = sanitizePhrase(meta.topic);

  let core: string;
  switch (spec.slot) {
    case "starter":
      core = `engaging lesson starter illustration for ${topic} in ${subject}, curiosity hooks, lightbulb and question motifs, clocks or timers, flat design, colorful, clean background, no human faces, school suitable`;
      break;
    case "main_teaching":
      core = `detailed educational diagram explaining ${topic}, step by step visual breakdown, labeled diagram, arrows showing process, flat design, professional, colorful, clean white background, no humans, no faces`;
      break;
    case "plenary":
      core = `flat design summary illustration related to ${topic}, key concepts shown as icons, light bulb idea symbol, reflection icons, colorful, clean background, no humans, no faces`;
      break;
    default:
      core = `professional educational illustration related to ${topic}, flat design, clean background, no humans, no faces`;
  }

  return `${core}, ${LANDSCAPE_RECT_SUFFIX}`;
}

const PPT_IMAGE_SIZE = "landscape_16_9" as const;
const PPT_NUM_INFERENCE_STEPS = 28;
const PPT_GUIDANCE_SCALE = 7.5;

/** Generates up to three FLUX Pro images for lesson PPT (starter, main phase, plenary). */
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

      const result = await client.subscribe(FAL_PPT_IMAGE_MODEL_ID, {
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
      out.push(null);
      const formatted = formatFalError(e);
      const raw = e instanceof Error ? e.message : String(e);
      console.error("[fal-ppt] image", n, "/", specs.length, "failed — skipping this image.", {
        slot: spec.slot,
        formatFalError: formatted,
        message: raw,
        error: e,
      });
    }
  }

  return out;
}
