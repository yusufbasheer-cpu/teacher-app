import type { LessonPlanInput } from "@/lib/lesson-plan";
import { SOURCE_MATERIAL_MAX_CHARS } from "@/lib/lesson-plan";
import { stripOuterMarkdownFences } from "@/lib/parse-teacher-package-response";
import {
  STRUCTURED_LESSON_DECK_SLIDE_COUNT,
  STRUCTURED_LESSON_SLIDE_TITLES_AR,
  STRUCTURED_LESSON_SLIDE_TITLES_EN,
} from "@/lib/ppt-structured-lesson";

/** Markers for one DeepSeek completion = one slide body only. */
export const SINGLE_PPT_SLIDE_BODY_START = "SINGLE PPT SLIDE BODY START" as const;
export const SINGLE_PPT_SLIDE_BODY_END = "SINGLE PPT SLIDE BODY END" as const;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract text between single-slide markers; tolerates optional ** around markers.
 */
export function parseSinglePptSlideModelResponse(raw: string): string {
  const trimmed = stripOuterMarkdownFences(raw?.trim() ?? "");
  const sEsc = escapeRe(SINGLE_PPT_SLIDE_BODY_START);
  const eEsc = escapeRe(SINGLE_PPT_SLIDE_BODY_END);
  const re = new RegExp(
    `(?:^|[\\r\\n])\\s*\\*{0,2}\\s*${sEsc}\\s*\\*{0,2}\\s*(?::)?\\s*[\\r\\n]+([\\s\\S]*?)(?:[\\r\\n]+\\s*\\*{0,2}\\s*${eEsc}\\s*\\*{0,2})`,
    "im",
  );
  const m = trimmed.match(re);
  const inner = m?.[1]?.trim();
  if (inner) return inner;
  const lower = trimmed.toLowerCase();
  const si = lower.indexOf(SINGLE_PPT_SLIDE_BODY_START.toLowerCase());
  if (si === -1) return stripOuterMarkdownFences(trimmed);
  let rest = trimmed.slice(si + SINGLE_PPT_SLIDE_BODY_START.length).replace(/^\s*\r?\n?/, "");
  const ei = rest.toLowerCase().indexOf(SINGLE_PPT_SLIDE_BODY_END.toLowerCase());
  if (ei !== -1) return rest.slice(0, ei).trim();
  return rest.trim();
}

/** Minimum trimmed length to accept a slide (avoid empty / one-word failures). */
const MIN_LEN: readonly number[] = [
  8, 40, 24, 24, 24, 140, 60, 72, 50, 40, 24, 40, 20,
];

export function slideBodyPassesQualityGate(slideNumber1Based: number, body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  const min = MIN_LEN[slideNumber1Based - 1] ?? 28;
  return t.length >= min;
}

/**
 * Join per-slide bodies into one outline string for `PPT Slide Content` storage / deck mining.
 * Each block starts with the canonical slide title line (English or Arabic per `useArabicTitles`).
 */
export function assembleFullPptFromSlideBodies(
  bodies: readonly string[],
  useArabicTitles: boolean,
): string {
  const titles = useArabicTitles ? STRUCTURED_LESSON_SLIDE_TITLES_AR : STRUCTURED_LESSON_SLIDE_TITLES_EN;
  const parts: string[] = [];
  for (let i = 0; i < STRUCTURED_LESSON_DECK_SLIDE_COUNT; i++) {
    const title = titles[i] ?? `Slide ${i + 1}`;
    const body = (bodies[i] ?? "").trim();
    parts.push(title);
    parts.push(body.length > 0 ? body : "(Content unavailable for this slide.)");
    parts.push("");
  }
  return parts.join("\n").trim();
}

/** One-line reminder per slide (English) for the single-slide user message. */
export const SINGLE_SLIDE_USER_FOCUS_EN: readonly string[] = [
  "Body lines only: subject name, grade, date — no topic, objectives, chapter, or activities.",
  "Starter only: hook and prediction; interactive task; embed Starter AFL if selected — no chapter or objectives.",
  "Chapter name, topic name, one SDG (number + title) only — no activities or objectives.",
  "Learning objectives only (Bloom verbs, 3–5 lines) — no outcomes, examples, or activities.",
  "Learning outcomes only (measurable) — aligned to objectives but not copied verbatim; no activities.",
  "Main phase only: full explanation first, then I/We/You-style activities — no plenary, differentiation, or exit ticket.",
  "Differentiated tasks (high/mid/low) plus one mini plenary checkpoint only — no UAE link, homework, or core re-teach.",
  "Exactly ONE link type only: UAE **or** real life **or** cross-curricular — pick the strongest only.",
  "Plenary only: reflection/recap/discussion — embed Plenary AFL if selected — no homework or new teaching.",
  "Extended task or homework only — embed Extended AFL if selected — no plenary re-teach.",
  "Exit ticket questions only — no homework paragraph or success criteria.",
  "Success criteria and self evaluation only — embed Feedback AFL if selected — no exit ticket repeat.",
  "Thank you plus one short positive closing line for students — no recap or new tasks.",
];

/**
 * User message for one slide-only DeepSeek call (class context + lesson anchor + slide focus).
 */
export function buildSinglePptSlideUserMessage(params: {
  slideNumber1Based: number;
  input: LessonPlanInput;
  sourceMaterial?: string;
  /** e.g. curriculum framework alignment line (may be empty). */
  frameworkUserLine: string;
  /** Truncated full lesson plan text from earlier generation (may be empty). */
  fullLessonPlan: string;
  /** Extra Arabic output block (may be empty). */
  arabicExtraBlock: string;
  /** AFL block for this slide only (may be empty). */
  aflForThisSlide: string;
  /** Shown on retry attempts only. */
  regenerateHint?: string;
}): string {
  const {
    slideNumber1Based: sn,
    input,
    sourceMaterial,
    frameworkUserLine,
    fullLessonPlan,
    arabicExtraBlock,
    aflForThisSlide,
    regenerateHint,
  } = params;

  const chapterLine =
    input.chapter.trim().length > 0
      ? `- Chapter / unit: ${input.chapter.trim()}`
      : `- Chapter / unit: (not specified — infer sensible scope from topic and grade if needed)`;

  const trimmedSource = sourceMaterial?.trim();
  const sourceBlock =
    trimmedSource && trimmedSource.length > 0
      ? `

### Source material (primary factual basis when present)
${trimmedSource.slice(0, SOURCE_MATERIAL_MAX_CHARS)}
`
      : "";

  const lessonBlock =
    fullLessonPlan.trim().length > 0
      ? `

### Full lesson plan (continuity — do not paste unrelated sections onto this slide)
Use only what you need for this slide’s purpose. Do not copy large blocks verbatim from here unless they truly belong on this slide type.

${fullLessonPlan.trim().slice(0, 14_000)}
`
      : "";

  const focus = SINGLE_SLIDE_USER_FOCUS_EN[sn - 1] ?? "";

  const retry =
    regenerateHint?.trim() && regenerateHint.trim().length > 0
      ? `\n\n### Regeneration\n${regenerateHint.trim()}`
      : "";

  return `
Generate **only slide ${sn} of ${STRUCTURED_LESSON_DECK_SLIDE_COUNT}** for the teacher PowerPoint.

### Class context
- Curriculum: ${input.curriculumType.trim()}
- Grade / Year group: ${input.grade.trim()}
- Subject: ${input.subject.trim()}
${chapterLine}
- Topic (within the chapter): ${input.topic.trim()}
- Teacher-provided learning objectives / focus: ${input.learningObjectives.trim()}${frameworkUserLine}
${sourceBlock}
${lessonBlock}
${arabicExtraBlock ? `\n${arabicExtraBlock}\n` : ""}
${aflForThisSlide ? `\n${aflForThisSlide}\n` : ""}

### This slide (slide ${sn}) — required focus
${focus}
${retry}

Output markers exactly as the system prompt specifies.
`.trim();
}
