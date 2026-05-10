import { createFalClient } from "@fal-ai/client";
import {
  FAL_FLUX_MODEL_ID,
  formatFalError,
  getFalCredentials,
} from "@/lib/fal-flux-section-images";

/** Required on every PPT slide image prompt (user + Islamic-safe visuals). */
export const PPT_SLIDE_IMAGE_PROMPT_RULES =
  "Mandatory: no human figures, no faces, no women; only objects, diagrams, icons, nature, and educational illustrations; age appropriate for school; follows Islamic content guidelines.";

export function buildPptSlideFluxPrompt(
  meta: { subject: string; grade: string; topic: string },
  slide: { title: string; body: string },
): string {
  const excerpt = slide.body.replace(/\s+/g, " ").trim().slice(0, 520);
  const lines = [
    `Educational illustration for a classroom slide titled: "${slide.title}".`,
    `Subject: ${meta.subject}. Grade: ${meta.grade}. Topic: ${meta.topic}.`,
    "Create a single clear visual: diagram, infographic, icons, symbols, or nature scene that supports the slide (not a photo of text or paragraphs).",
    `Slide content to inspire the visual: ${excerpt}`,
    "",
    PPT_SLIDE_IMAGE_PROMPT_RULES,
  ];
  const body = lines.join("\n");
  return body.length > 1900 ? `${body.slice(0, 1900)}…` : body;
}

/**
 * One FLUX image per slide, in order. Null entries mean generation or API skipped that slide.
 */
export async function generatePptSlideImageUrls(
  meta: { subject: string; grade: string; topic: string },
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
          image_size: "landscape_4_3",
          num_images: 1,
          num_inference_steps: 24,
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
