import { ApiError, createFalClient } from "@fal-ai/client";
import {
  FAL_BALANCE_EXHAUSTED_USER_MESSAGE,
  formatFalError,
  getFalCredentials,
  isFalAccountLockedError,
} from "@/lib/fal-flux-section-images";

/** FLUX dev endpoint with NAG negative-prompt support for reliable text/person exclusion. */
export const FAL_PPT_IMAGE_MODEL_ID = "fal-ai/flux-general" as const;

export type PptSlideImageMeta = {
  subject: string;
  grade: string;
  topic: string;
  curriculumFramework?: string;
  /**
   * A short extract of the actual lesson content for this slide. Used to make the four
   * Fal-required slides contextually specific instead of generic stock-style artwork.
   */
  lessonContentSnippet?: string;
};

/** Mandatory wording for every fal PPT image (user requirement). */
export const FAL_PPT_SAFETY_SUFFIX =
  "object-only scene, absolutely no people, no human figures, no faces, no silhouettes, no body parts, Islamic appropriate, school suitable";

/**
 * Diffusion models render lettering as malformed pseudo-glyphs, and Arabic script - which is
 * cursive and context-shaped - comes out especially mangled. None of these slide images are
 * meant to carry words, so every prompt says so explicitly.
 */
export const FAL_PPT_NO_TEXT_SUFFIX =
  "text-free image using only unmarked objects, colors, and shapes";

const LANDSCAPE_RECT =
  "full 16:9 landscape composition; main objects large and centered, occupying most of the frame; every object complete inside a 7 percent safe margin";

const COMPLETE_SCENE =
  "One coherent educational scene, not a template or unrelated icon collection";

const FAL_PPT_NEGATIVE_PROMPT =
  "people, person, child, student, teacher, man, woman, face, human figure, silhouette, hands, body parts, text, typography, letters, words, digits, numbers, equations, mathematical notation, question mark, checkmark, caption, label, logo, watermark, signage, gibberish, cropped object, cut-off object, partial object, object touching frame edge, unfinished object, blank board, blank poster, blank worksheet, empty placeholder panel, excessive empty space, circular crop, vignette";

function subjectVisualObjects(subject: string, topic: string): string {
  const haystack = `${subject} ${topic}`.toLowerCase();
  if (/algebra|expression|equation|variable|coefficient|like term/.test(haystack)) {
    return "color-coded algebra tiles, long rectangular variable tiles, small square unit tiles, matching tile groups, and a balance mat, all without printed symbols";
  }
  if (/fraction|decimal|percent|ratio|proportion/.test(haystack)) {
    return "fraction circles, base-ten blocks, grouped counters, and measuring strips, all without printed symbols";
  }
  if (/math|mathematics|geometry|number/.test(haystack)) {
    return "color-coded counting blocks, geometric manipulatives, grouped counters, and a balance scale, all without printed symbols";
  }
  if (/science|biology|chemistry|physics/.test(haystack)) {
    return "complete laboratory apparatus, natural specimens, and a physical process model directly associated with the topic";
  }
  if (/english|language|literacy|reading|writing/.test(haystack)) {
    return "closed books, story-sequence objects, picture cards with no markings, and concrete objects from the lesson theme";
  }
  if (/geography|history|social|humanities/.test(haystack)) {
    return "a globe, map-shaped physical pieces without labels, timeline objects, and artifacts directly associated with the topic";
  }
  if (/computer|technology|computing|coding/.test(haystack)) {
    return "complete electronic components, connected blocks, gears, and device parts with blank unmarked surfaces";
  }
  return "complete physical learning objects and concrete visual metaphors directly associated with the lesson topic";
}

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

function sanitizeLessonContext(s: string): string {
  return s
    .replace(/["'`][^"'`]{1,180}["'`]/g, " ")
    .replace(
      /\b\d+(?:\.\d+)?[a-zA-Z]?(?:\s*[+\-=]\s*\d+(?:\.\d+)?[a-zA-Z]?)+\b/g,
      " grouped lesson manipulatives ",
    )
    .replace(/\b(students?|teachers?|children?|people|partners?|friends?|class)\b/gi, "lesson")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function buildLessonPptFluxPrompt(meta: PptSlideImageMeta, slot: LessonPptFluxSlot): string {
  const subject = sanitizePhrase(meta.subject);
  const grade = sanitizePhrase(meta.grade);
  const topic = sanitizePhrase(meta.topic);
  const visualObjects = subjectVisualObjects(subject, topic);

  let core: string;
  switch (slot) {
    case "sdg_chapter":
      core = `An open book, small globe, healthy plant, and ${visualObjects}, integrated to connect sustainable quality education with ${topic}`;
      break;
    case "main_teaching":
      core = `A clear visual analogy for ${topic}: ${visualObjects}, arranged to demonstrate grouping, matching, and relationships`;
      break;
    case "differentiated_activity":
      core = `Three side-by-side activity trays about ${topic}, each using ${visualObjects}: simple matching, standard sorting, and a richer challenge, distinguished by arrangement and quantity`;
      break;
    case "exit_ticket":
      core = `An end-of-lesson assessment still life for ${topic}: one tray of correctly sorted ${visualObjects}, a closed pencil, and a plain completion token`;
      break;
    case "success_criteria":
      core = `A completed learning journey for ${topic}: three neatly finished groups of ${visualObjects} leading toward a small medal and star-shaped object`;
      break;
    case "title_slide_fal_fallback":
      core = `A strong hero still life for ${topic} in ${subject}, centered on ${visualObjects}`;
      break;
    case "fallback_pexels_title":
      core = `A strong hero still life for ${topic} in ${subject}, centered on ${visualObjects}`;
      break;
    case "fallback_pexels_starter":
      core = `A hands-on discovery starter for ${topic}: a magnifying glass, covered mystery object, and matching versus non-matching sets of ${visualObjects}`;
      break;
    case "fallback_pexels_uae":
      core = /uae|united arab emirates|moe/i.test(meta.curriculumFramework ?? "")
        ? `A practical UAE real-life application of ${topic}, using the concrete objects from the slide scenario plus ${visualObjects}, with one subtle UAE architectural motif in the background`
        : `A practical everyday-life application of ${topic}, using the concrete objects from the slide scenario plus ${visualObjects}, organized into meaningful groups`;
      break;
    case "fallback_pexels_plenary":
      core = `A visual recap of ${topic}: ${visualObjects} neatly sorted into completed groups, with a small reflection mirror and closed notebook`;
      break;
    case "fallback_pexels_extended":
      core = `An independent real-world investigation kit for ${topic}: a magnifying glass surrounded by concrete objects from the slide task and ${visualObjects}, arranged to compare and classify`;
      break;
    default:
      core = `A professional educational illustration directly representing ${topic} in ${subject}`;
  }

  const context = meta.lessonContentSnippet
    ? sanitizeLessonContext(meta.lessonContentSnippet)
    : "";
  const contextClause = context
    ? ` The scene must first and foremost depict this slide context: ${context}.`
    : "";
  return `${COMPLETE_SCENE}.${contextClause} Visual approach: ${core}. Modern flat editorial illustration, crisp shapes, cohesive palette, clean light background, age-appropriate for ${grade}. ${LANDSCAPE_RECT}. ${FAL_PPT_SAFETY_SUFFIX}. ${FAL_PPT_NO_TEXT_SUFFIX}.`;
}

const PPT_IMAGE_SIZE = "landscape_16_9" as const;
const PPT_NUM_INFERENCE_STEPS = 28;
const PPT_GUIDANCE_SCALE = 3.5;

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

/** Distinguishes "fal took too long" from "fal said no" - previously indistinguishable. */
class FalTimeoutError extends Error {
  constructor(ms: number) {
    super(`timed out after ${ms}ms`);
    this.name = "FalTimeoutError";
  }
}

/**
 * Races a promise against a timeout.
 *
 * This used to catch and discard every rejection, which meant a 401/402/403/422 from fal was
 * reported as a 90-second timeout and the account-locked circuit breaker below could never
 * fire. Rejections now propagate so the caller can classify them.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new FalTimeoutError(ms)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/** Why a fal image could not be produced. Recorded per slide so failures stay visible. */
export type FalImageFailureKind =
  | "not-configured"
  | "circuit-open"
  | "timeout"
  | "auth"
  | "balance"
  | "rate-limit"
  | "empty-response"
  | "error";

export type FalImageOutcome =
  | { ok: true; url: string }
  | { ok: false; kind: FalImageFailureKind; reason: string };

function classifyFalError(err: unknown): { kind: FalImageFailureKind; reason: string } {
  if (err instanceof FalTimeoutError) {
    return { kind: "timeout", reason: err.message };
  }
  if (isFalAccountLockedError(err)) {
    return { kind: "balance", reason: FAL_BALANCE_EXHAUSTED_USER_MESSAGE };
  }
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return { kind: "auth", reason: `fal rejected the credentials (HTTP ${err.status})` };
    }
    if (err.status === 429) {
      return { kind: "rate-limit", reason: "fal rate limit reached (HTTP 429)" };
    }
    return { kind: "error", reason: formatFalError(err) };
  }
  return { kind: "error", reason: formatFalError(err) };
}

/**
 * Single fal.ai FLUX image from a full prompt string (already includes safety + landscape).
 *
 * Returns a classified outcome rather than `string | null`, so the resolver can tell "fal is
 * not configured" from "fal refused the key" from "fal timed out" and record it. Every one of
 * those used to arrive as an indistinguishable null.
 */
export async function generateFalPptImageFromPrompt(
  fullPrompt: string,
  callOptions?: FalPptImageCallOptions,
): Promise<FalImageOutcome> {
  const label = callOptions?.logLabel ?? "fal-ppt";
  if (falPptCircuitOpenReason) {
    console.warn(`[fal-ppt][${label}] skipped - ${falPptCircuitOpenReason}`);
    return { ok: false, kind: "circuit-open", reason: falPptCircuitOpenReason };
  }

  const credentials = getFalCredentials();
  if (!credentials) {
    const reason = "fal credentials are not configured (set FAL_API_KEY or FAL_KEY)";
    console.error(`[fal-ppt][${label}] ${reason}`);
    return { ok: false, kind: "not-configured", reason };
  }

  const client = createFalClient({ credentials });
  try {
    const input = {
      prompt: fullPrompt,
      image_size: PPT_IMAGE_SIZE,
      num_images: 1,
      num_inference_steps: PPT_NUM_INFERENCE_STEPS,
      guidance_scale: PPT_GUIDANCE_SCALE,
      negative_prompt: FAL_PPT_NEGATIVE_PROMPT,
      nag_scale: 4,
      enable_safety_checker: true,
      output_format: "png" as const,
    };

    // console.error so this survives `removeConsole` in production builds, which strips
    // console.log and would otherwise leave provider selection completely unobservable.
    console.error(
      `[fal-ppt][${label}] request model=${FAL_PPT_IMAGE_MODEL_ID} promptChars=${fullPrompt.length}`,
    );

    const result = await withTimeout(
      client.subscribe(FAL_PPT_IMAGE_MODEL_ID, { input }) as Promise<{
        data?: { images?: { url?: string }[] };
      }>,
      FAL_IMAGE_TIMEOUT_MS,
    );

    const url = result?.data?.images?.[0]?.url;
    if (typeof url === "string" && url.length > 0) {
      console.error(`[fal-ppt][${label}] OK image generated`);
      return { ok: true, url };
    }

    const reason = "fal returned a response with no image URL";
    console.error(
      `[fal-ppt][${label}] FAILED: ${reason}. data snapshot:`,
      safeJsonForLog(result?.data ?? result, 2000),
    );
    return { ok: false, kind: "empty-response", reason };
  } catch (e) {
    const { kind, reason } = classifyFalError(e);
    // A locked/exhausted account is the one failure worth short-circuiting: every remaining
    // slot would fail identically and each costs a full round trip.
    if (kind === "balance") {
      falPptCircuitOpenReason = FAL_BALANCE_EXHAUSTED_USER_MESSAGE;
    }
    console.error(`[fal-ppt][${label}] FAILED (${kind}): ${reason}`);
    return { ok: false, kind, reason };
  }
}

/**
 * Generate one deck image; retries once with a variant prompt if the URL duplicates `usedUrls`.
 *
 * The caller reserves the returned URL immediately (see `ppt-image-resolver.ts`) - the shared
 * set used to be populated only after every parallel call had resolved, so dedup never
 * actually saw anything and slides could repeat the same image.
 */
export async function generateLessonPptFluxImageDeduped(
  meta: PptSlideImageMeta,
  slot: LessonPptFluxSlot,
  usedUrls: Set<string>,
  callOptions?: FalPptImageCallOptions,
): Promise<FalImageOutcome> {
  let prompt = buildLessonPptFluxPrompt(meta, slot);
  const label = callOptions?.logLabel ?? `slot:${slot}`;
  let last: FalImageOutcome = { ok: false, kind: "error", reason: "no attempt made" };
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1) {
      prompt = `${prompt} Alternate composition and layout variant B, different arrangement of elements.`;
    }
    last = await generateFalPptImageFromPrompt(prompt, {
      ...callOptions,
      logLabel: attempt === 0 ? label : `${label}-retry`,
    });
    if (!last.ok) return last;
    if (!usedUrls.has(last.url)) return last;
    console.warn(`[fal-ppt][${label}] duplicate URL from fal - retrying variant if attempts remain`);
  }
  return { ok: false, kind: "empty-response", reason: "fal returned only duplicate images" };
}

/** @deprecated Prefer {@link generateLessonPptFluxImageDeduped} per slot. */
export async function generateLessonPptSlideImages(
  meta: PptSlideImageMeta,
  specs: LessonPptImageGenerationSpec[],
): Promise<(string | null)[]> {
  const used = new Set<string>();
  const out: (string | null)[] = [];
  for (const spec of specs) {
    const outcome = await generateLessonPptFluxImageDeduped(meta, spec.slot, used);
    const url = outcome.ok ? outcome.url : null;
    out.push(url);
    if (url) used.add(url);
  }
  return out;
}
