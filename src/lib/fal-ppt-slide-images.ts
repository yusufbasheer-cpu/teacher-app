import { createFalClient } from "@fal-ai/client";
import { buildCurriculumFrameworkImageHint } from "@/lib/curriculum-framework";
import {
  FAL_FLUX_MODEL_ID,
  formatFalError,
  getFalCredentials,
} from "@/lib/fal-flux-section-images";

const PROMPT_MAX_LEN = 1900;

/** Appended to every lesson-PPT image prompt (layout + safety). */
export const LESSON_PPT_IMAGE_STYLE_SUFFIX =
  "flat design style, clean background, no circular crop, no round frame, rectangular image, professional educational illustration, no human figures, no faces, Islamic appropriate";

function compressSnippet(text: string, maxLen: number): string {
  const oneLine = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/^[\s>*•\-–—\d]+[\.\)]?\s*/, "")
        .replace(/^#{1,6}\s*/, "")
        .trim(),
    )
    .filter(Boolean)
    .join(", ")
    .replace(/\s+/g, " ")
    .trim();
  const cleaned = oneLine.replace(/https?:\/\/\S+/gi, "").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen).trim()}…`;
}

export type PptSlideImageMeta = {
  subject: string;
  grade: string;
  topic: string;
  curriculumFramework?: string;
};

export type LessonPptImageSlot = "title" | "main_teaching" | "group_activity" | "plenary";

export type LessonPptImageGenerationSpec = {
  slot: LessonPptImageSlot;
  slideTitle: string;
  bodySnippet: string;
};

/**
 * Topic-specific FLUX prompt for one of the four allowed lesson-PPT images.
 * Example style: concrete nouns from topic (e.g. photosynthesis → leaf, chloroplasts, arrows for glucose/oxygen).
 */
export function buildLessonPptFluxPrompt(
  meta: PptSlideImageMeta,
  spec: LessonPptImageGenerationSpec,
): string {
  const subject = meta.subject.replace(/\s+/g, " ").trim();
  const topic = meta.topic.replace(/\s+/g, " ").trim();
  const grade = meta.grade.replace(/\s+/g, " ").trim();
  const frameworkHint = buildCurriculumFrameworkImageHint(meta.curriculumFramework ?? "");
  const detail = compressSnippet(`${spec.slideTitle}. ${spec.bodySnippet}`, 720);

  const slotIntro: Record<LessonPptImageSlot, string> = {
    title: `Flat design educational hero illustration for opening slide: subject "${subject}", grade ${grade}, topic "${topic}". Show iconic symbols and diagrams that instantly signal this unit (no readable words in the artwork).`,
    main_teaching: `Flat design educational diagram for main teaching of "${topic}" in ${subject} (${grade}). Show clear instructional flow: stages, arrows, labeled-style shapes as icons only, schematic relationships (e.g. process, structure, or mechanism appropriate to the topic).`,
    group_activity: `Flat design educational illustration for collaborative work on "${topic}" in ${subject}: shared task materials, icons, and cooperative workflow symbols only (no people, no faces).`,
    plenary: `Flat design educational summary illustration for lesson closure on "${topic}" in ${subject}: recap icons, checklist motifs, reflection prompts as abstract symbols only (no text in image).`,
  };

  const coreParts = [
    slotIntro[spec.slot],
    frameworkHint,
    detail ? `Lesson content cues (non-literal, for symbolism only): ${detail}` : null,
    "Vibrant colors, clean white or very light neutral background, crisp vector-like shapes, high clarity for projection.",
    LESSON_PPT_IMAGE_STYLE_SUFFIX,
  ].filter((p): p is string => Boolean(p));

  const full = coreParts.join(" ");
  return full.length > PROMPT_MAX_LEN ? `${full.slice(0, PROMPT_MAX_LEN)}…` : full;
}

function imageSizeForSlot(slot: LessonPptImageSlot): "landscape_16_9" | "square_hd" {
  if (slot === "group_activity") return "square_hd";
  return "landscape_16_9";
}

/** Generates exactly four images (title, main teaching, group activity, plenary), in that order. */
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

  console.log("[fal-ppt] generating", specs.length, "lesson PPT image(s), model:", FAL_FLUX_MODEL_ID);

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]!;
    const n = i + 1;
    try {
      const prompt = buildLessonPptFluxPrompt(meta, spec);
      const image_size = imageSizeForSlot(spec.slot);
      const result = await client.subscribe(FAL_FLUX_MODEL_ID, {
        input: {
          prompt,
          image_size,
          num_images: 1,
          num_inference_steps: 28,
          guidance_scale: 7.5,
          enable_safety_checker: true,
          output_format: "png",
        },
      });
      const url = result.data?.images?.[0]?.url;
      if (typeof url === "string" && url.length > 0) {
        out.push(url);
        console.log("[fal-ppt] image", n, "/", specs.length, "ok", { slot: spec.slot, image_size });
      } else {
        out.push(null);
        console.error("[fal-ppt] image", n, "no URL", JSON.stringify(result.data).slice(0, 300));
      }
    } catch (e) {
      out.push(null);
      console.error("[fal-ppt] image", n, "failed:", formatFalError(e));
    }
  }

  return out;
}
