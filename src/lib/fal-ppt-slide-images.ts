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

/** Exactly five PPT slide types that receive images (indices 0, 4, 6, 8, 12 in the structured deck). */
export type LessonPptImageSlot =
  | "title"
  | "main_teaching"
  | "group_activity"
  | "afl_tools"
  | "plenary";

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
    case "title":
      core = `professional educational illustration of ${subject} for grade ${grade} students, flat design style, colorful icons and symbols related to ${topic}, clean white background, vibrant colors, no humans, no faces, no text, Islamic appropriate, school suitable`;
      break;
    case "main_teaching":
      core = `detailed educational diagram explaining ${topic}, step by step visual breakdown, labeled diagram, arrows showing process, flat design, professional, colorful, clean white background, no humans, no faces`;
      break;
    case "group_activity":
      core = `flat design illustration of collaborative learning icons, puzzle pieces connecting, teamwork symbols related to ${topic}, colorful, engaging, no human figures, no faces, clean background`;
      break;
    case "afl_tools":
      core = `flat design illustration of assessment tools, checkboxes, quiz icons, thumbs up symbol, feedback arrows, colorful, clean background, no humans, no faces, professional educational style`;
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

/** Generates up to five FLUX Pro images for lesson PPT (title, main, group, AFL, plenary). */
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
