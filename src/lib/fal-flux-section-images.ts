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

/**
 * fal keys are `<uuid>:<hex>`. Validating the shape mirrors what `image-api-env.ts` already does
 * for Pexels, and matters because an unvalidated key made "revoked/malformed key" look exactly
 * like "fal is fine" right up until every image silently failed.
 */
const FAL_KEY_SHAPE = /^[0-9a-f-]{20,}:[0-9a-f]{16,}$/i;

export function isPlausibleFalApiKey(value: string): boolean {
  return FAL_KEY_SHAPE.test(value.trim());
}

/**
 * Supports `FAL_API_KEY` (app convention) or fal's documented `FAL_KEY`.
 *
 * Deliberately logs nothing derived from the key itself - not even a masked preview, which
 * still leaks length and the leading/trailing characters into server logs.
 */
export function getFalCredentials(): string | undefined {
  const fromApi = process.env.FAL_API_KEY?.trim();
  const fromFal = process.env.FAL_KEY?.trim();
  const key = fromApi || fromFal;
  if (!key) {
    console.error("[fal] no credentials: set FAL_API_KEY or FAL_KEY in the server environment.");
    return undefined;
  }
  if (!isPlausibleFalApiKey(key)) {
    console.error(
      `[fal] credentials from ${fromApi ? "FAL_API_KEY" : "FAL_KEY"} are not in fal's expected ` +
        "<id>:<secret> format - image generation will fail until this is corrected.",
    );
  }
  return key;
}

export const FAL_BALANCE_EXHAUSTED_USER_MESSAGE =
  "fal.ai account has no balance. Top up at https://fal.ai/dashboard/billing — PPT images from fal will be skipped until then.";

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

/** True when fal rejects requests because the account has no balance / is locked. */
export function isFalAccountLockedError(err: unknown): boolean {
  if (err instanceof ApiError) {
    if (err.status === 402 || err.status === 403) {
      const bodyStr = JSON.stringify(err.body ?? "").toLowerCase();
      if (
        bodyStr.includes("exhausted balance") ||
        bodyStr.includes("user is locked") ||
        bodyStr.includes("insufficient")
      ) {
        return true;
      }
    }
  }
  const msg = formatFalError(err).toLowerCase();
  return msg.includes("exhausted balance") || msg.includes("user is locked");
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

  const client = createFalClient({ credentials });
  const out: SectionImageMap = {};
  const errors: Partial<Record<TeacherPackageSectionKey, string>> = {};

  console.log("[fal-flux] batch start", {
    model: FAL_FLUX_MODEL_ID,
    sectionCount: params.sections.length,
  });

  for (const section of params.sections) {
    const text = params.plan[section];
    if (typeof text !== "string" || !text.trim()) continue;

    try {
      const prompt = buildFluxPrompt(params.input, section, text);
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
        out[section] = [url];
        console.log("[fal-flux] ok", { section, urlPreview: url.slice(0, 80) });
      } else {
        const msg = `fal returned no image URL; data=${JSON.stringify(result.data).slice(0, 400)}`;
        errors[section] = msg;
        console.error("[fal-flux] empty url", { section, data: result.data });
      }
    } catch (e) {
      const msg = isFalAccountLockedError(e) ? FAL_BALANCE_EXHAUSTED_USER_MESSAGE : formatFalError(e);
      errors[section] = msg;
      console.error("[fal-flux] subscribe failed", { section, error: msg, raw: e });
      if (isFalAccountLockedError(e)) break;
    }
  }

  console.log("[fal-flux] batch done", {
    successSections: Object.keys(out).length,
    errorSections: Object.keys(errors).length,
  });

  return { sectionImages: out, errors };
}
