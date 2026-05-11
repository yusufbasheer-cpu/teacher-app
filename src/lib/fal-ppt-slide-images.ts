import { createFalClient } from "@fal-ai/client";
import { buildCurriculumFrameworkImageHint } from "@/lib/curriculum-framework";
import {
  FAL_FLUX_MODEL_ID,
  formatFalError,
  getFalCredentials,
} from "@/lib/fal-flux-section-images";

/** Appended to every PPT slide image prompt for consistent look and resolution. */
export const PPT_SLIDE_IMAGE_QUALITY_TAGS =
  "professional educational illustration, flat design, vibrant colors, clean background, high quality, suitable for school PowerPoint presentation";

/** Mandatory restrictions on every slide image (user + Islamic-safe visuals). */
export const PPT_SLIDE_IMAGE_RESTRICTIONS =
  "no human figures, no faces, no women, no text in image, no watermarks, follows Islamic content guidelines";

const PROMPT_MAX_LEN = 1900;

/** @deprecated Use PPT_SLIDE_IMAGE_RESTRICTIONS; kept for any external imports. */
export const PPT_SLIDE_IMAGE_PROMPT_RULES = PPT_SLIDE_IMAGE_RESTRICTIONS;

function compressSlideBodyForVisualPrompt(body: string, maxLen: number): string {
  const lines = body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/^[\s>*•\-–—\d]+[\.\)]?\s*/, "")
        .replace(/^#{1,6}\s*/, "")
        .trim(),
    )
    .filter((line) => line.length > 0);

  let t = lines.join(", ").replace(/\s+/g, " ").trim();
  t = t.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  const lastBreak = Math.max(slice.lastIndexOf(", "), slice.lastIndexOf("; "));
  const head = lastBreak > maxLen * 0.5 ? slice.slice(0, lastBreak) : slice;
  return `${head.trimEnd()}…`;
}

export type PptSlideImageMeta = {
  subject: string;
  grade: string;
  topic: string;
  /** Optional; improves slide imagery alignment when re-exporting with a framework. */
  curriculumFramework?: string;
};

/**
 * One cohesive, slide-specific prompt: subject, topic, key concept (title), and
 * body-derived visual elements (diagram style like the photosynthesis example).
 */
export function buildPptSlideFluxPrompt(
  meta: PptSlideImageMeta,
  slide: { title: string; body: string },
): string {
  const subject = meta.subject.replace(/\s+/g, " ").trim();
  const topic = meta.topic.replace(/\s+/g, " ").trim();
  const grade = meta.grade.replace(/\s+/g, " ").trim();
  const keyConcept = slide.title.replace(/\s+/g, " ").trim() || "main lesson idea";
  const visualDetail = compressSlideBodyForVisualPrompt(slide.body, 580);
  const frameworkHint = buildCurriculumFrameworkImageHint(meta.curriculumFramework ?? "");

  const coreParts = [
    `Educational diagram for school use: subject "${subject}", topic "${topic}", grade ${grade}.`,
    frameworkHint,
    `This slide's key concept: "${keyConcept}".`,
    visualDetail
      ? `Show specifically (invent clear symbols and flow, no readable words in the artwork): ${visualDetail}.`
      : `Illustrate the concept "${keyConcept}" with clear symbols, stages, arrows, and relationships.`,
    "Style: clear instructional infographic — icons, process flow, cross-sections, or schematic relationships; flat vector look; colorful and easy to read at a glance.",
  ].filter((p): p is string => Boolean(p));

  const core = coreParts.join(" ");

  const full = [
    core,
    PPT_SLIDE_IMAGE_QUALITY_TAGS,
    PPT_SLIDE_IMAGE_RESTRICTIONS,
  ].join(" ");

  return full.length > PROMPT_MAX_LEN ? `${full.slice(0, PROMPT_MAX_LEN)}…` : full;
}

/**
 * One FLUX image per slide, in order. Null entries mean generation or API skipped that slide.
 */
export async function generatePptSlideImageUrls(
  meta: PptSlideImageMeta,
  slides: { title: string; body: string }[],
): Promise<(string | null)[]> {
  const credentials = getFalCredentials();
  if (!credentials) {
    console.log("[fal-ppt] no FAL_API_KEY/FAL_KEY — exporting PPT without slide images");
    return slides.map(() => null);
  }

  const client = createFalClient({ credentials });
  const out: (string | null)[] = [];

  console.log("[fal-ppt] generating images for", slides.length, "slide(s), model:", FAL_FLUX_MODEL_ID);

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]!;
    const n = i + 1;
    try {
      const prompt = buildPptSlideFluxPrompt(meta, slide);
      const result = await client.subscribe(FAL_FLUX_MODEL_ID, {
        input: {
          prompt,
          image_size: "landscape_16_9",
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
        console.log("[fal-ppt] slide", n, "/", slides.length, "image ok");
      } else {
        out.push(null);
        console.error("[fal-ppt] slide", n, "no URL in response", JSON.stringify(result.data).slice(0, 300));
      }
    } catch (e) {
      const msg = formatFalError(e);
      out.push(null);
      console.error("[fal-ppt] slide", n, "failed:", msg);
    }
  }

  return out;
}
