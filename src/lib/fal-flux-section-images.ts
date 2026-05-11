import { ApiError, ValidationError, createFalClient } from "@fal-ai/client";
import { buildCurriculumFrameworkImageHint } from "@/lib/curriculum-framework";
import type {
  LessonPlanInput,
  LessonPlanResult,
  SectionImageMap,
  TeacherPackageSectionKey,
} from "@/lib/lesson-plan";

/** Official fal model id for FLUX.1 [dev] text-to-image. */
export const FAL_FLUX_MODEL_ID = "fal-ai/flux-1/dev" as const;

/**
 * Appended to every image prompt. User requirements + Islamic-safe classroom visuals.
 */
const VISUAL_RESTRICTIONS =
  "Mandatory rules for this image: no human figures, no faces, no women; only objects, diagrams, icons, nature, and educational illustrations; age-appropriate for school; follows Islamic content guidelines.";

function excerptForPrompt(text: string, maxLen: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen)}…`;
}

function buildFluxPrompt(
  input: LessonPlanInput,
  sectionKey: TeacherPackageSectionKey,
  sectionText: string,
): string {
  const chapter = input.chapter.trim();
  const frameworkHint = buildCurriculumFrameworkImageHint(input.curriculumFramework);
  const parts = [
    `Curriculum: ${input.curriculumType.trim()}`,
    `Grade: ${input.grade.trim()}`,
    `Subject: ${input.subject.trim()}`,
    chapter ? `Chapter: ${chapter}` : null,
    `Topic: ${input.topic.trim()}`,
    frameworkHint,
    `Lesson section to illustrate: "${sectionKey}"`,
    "",
    "Single educational illustration: diagram, infographic-style layout, icons, or symbolic objects suitable for a slide or worksheet header. Draw ideas from this teaching content (avoid long paragraphs of on-image text):",
    excerptForPrompt(sectionText, 520),
    "",
    VISUAL_RESTRICTIONS,
  ].filter((p): p is string => Boolean(p));

  const body = parts.join("\n");
  return body.length > 1900 ? `${body.slice(0, 1900)}…` : body;
}

export async function generateFluxSectionImageForKey(
  input: LessonPlanInput,
  sectionKey: TeacherPackageSectionKey,
  sectionText: string,
): Promise<{ url: string | null; error?: string }> {
  const credentials = getFalCredentials();
  if (!credentials) {
    return { url: null };
  }

  const client = createFalClient({ credentials });
  try {
    const prompt = buildFluxPrompt(input, sectionKey, sectionText);
    const result = await client.subscribe(FAL_FLUX_MODEL_ID, {
      input: {
        prompt,
        image_size: "landscape_4_3",
        num_images: 1,
        num_inference_steps: 28,
        enable_safety_checker: true,
        output_format: "png",
      },
    });

    const url = result.data?.images?.[0]?.url;
    if (typeof url === "string" && url.length > 0) {
      return { url };
    }
    return {
      url: null,
      error: `fal returned no image URL; data=${JSON.stringify(result.data).slice(0, 400)}`,
    };
  } catch (e) {
    return { url: null, error: formatFalError(e) };
  }
}

/** Supports `FAL_API_KEY` (app convention) or fal’s documented `FAL_KEY`. */
export function getFalCredentials(): string | undefined {
  const fromApi = process.env.FAL_API_KEY?.trim();
  const fromFal = process.env.FAL_KEY?.trim();
  const key = fromApi || fromFal;
  if (!key) {
    console.warn(
      "[fal] no credentials: set FAL_API_KEY or FAL_KEY in .env.local (server-side).",
    );
  } else {
    const preview =
      key.length > 12 ? `${key.slice(0, 4)}…${key.slice(-4)} (len=${key.length})` : "(set)";
    const source = fromApi ? "FAL_API_KEY" : "FAL_KEY";
    console.log(`[fal] credentials loaded from ${source}: ${preview}`);
  }
  return key;
}

export function formatFalError(err: unknown): string {
  if (err instanceof ValidationError) {
    try {
      return `ValidationError HTTP ${err.status}: ${err.message} | detail: ${JSON.stringify(err.body)}`;
    } catch {
      return `ValidationError HTTP ${err.status}: ${err.message}`;
    }
  }
  if (err instanceof ApiError) {
    try {
      return `ApiError HTTP ${err.status}: ${err.message} | body: ${JSON.stringify(err.body)} | requestId: ${err.requestId || "n/a"}`;
    } catch {
      return `ApiError HTTP ${err.status}: ${err.message}`;
    }
  }
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}

export type FluxSectionImageGenerationResult = {
  sectionImages: SectionImageMap;
  /** Per-section fal failures (exact messages for debugging). */
  errors: Partial<Record<TeacherPackageSectionKey, string>>;
};

export async function generateFluxSectionImages(params: {
  input: LessonPlanInput;
  plan: LessonPlanResult;
  sections: readonly TeacherPackageSectionKey[];
}): Promise<FluxSectionImageGenerationResult> {
  const credentials = getFalCredentials();
  if (!credentials) {
    return { sectionImages: {}, errors: {} };
  }

  console.log("[fal-flux] batch start", {
    model: FAL_FLUX_MODEL_ID,
    sectionCount: params.sections.length,
  });

  const pairs = await Promise.all(
    params.sections.map(async (section) => {
      const text = params.plan[section];
      if (typeof text !== "string" || !text.trim()) {
        return { section, url: null as string | null, error: undefined as string | undefined };
      }
      const { url, error } = await generateFluxSectionImageForKey(params.input, section, text);
      if (url) {
        console.log("[fal-flux] ok", { section, urlPreview: url.slice(0, 80) });
      } else if (error) {
        console.error("[fal-flux] empty url", { section, error });
      }
      return { section, url, error };
    }),
  );

  const out: SectionImageMap = {};
  const errors: Partial<Record<TeacherPackageSectionKey, string>> = {};
  for (const { section, url, error } of pairs) {
    if (url) {
      out[section] = [url];
    } else if (error) {
      errors[section] = error;
    }
  }

  console.log("[fal-flux] batch done", {
    successSections: Object.keys(out).length,
    errorSections: Object.keys(errors).length,
  });

  return { sectionImages: out, errors };
}
