import type { LessonPlanInput } from "@/lib/lesson-plan";
import { buildSourceMaterialPromptBlock, SOURCE_MATERIAL_MAX_CHARS } from "@/lib/lesson-plan";
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
  8, 40, 24, 4, 24, 140, 60, 72, 50, 40, 24, 40, 20,
];

export function slideBodyPassesQualityGate(slideNumber1Based: number, body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  if (slideNumber1Based === 4) return t.length >= 4;
  const min = MIN_LEN[slideNumber1Based - 1] ?? 28;
  return t.length >= min;
}

/** Slide 5: outcomes count should not exceed teacher objective count (when objectives are known). */
export function slide5OutcomesAlignWithTeacherObjectives(
  outcomesBody: string,
  teacherObjectivesRaw: string,
): boolean {
  const objectiveCount = countTeacherObjectiveLines(teacherObjectivesRaw);
  if (objectiveCount === 0) return outcomesBody.trim().length >= 24;
  const outcomeLines = outcomesBody
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !lineIsSlideTitleEcho(5, l, false) && !lineIsSlideTitleEcho(5, l, true));
  if (outcomeLines.length === 0) return false;
  if (outcomeLines.length !== objectiveCount) return false;
  return true;
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

/** Slide 1 body: grade + date only (subject lives in the slide title, not the body). */
export function buildProgrammaticSlide1Body(grade: string, dateStr: string): string {
  const g = grade.trim();
  const d = dateStr.trim();
  return [g, d].filter(Boolean).join("\n");
}

/**
 * Slide 4 body: teacher form objectives verbatim (line breaks preserved; empty lines dropped only).
 * Does not paraphrase, expand, or add objectives.
 */
export function buildTeacherObjectivesSlide4Body(teacherObjectivesRaw: string): string {
  const lines = teacherObjectivesRaw.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const t = line.replace(/\s+$/g, "");
    if (!t.trim()) continue;
    if (lineIsSlideTitleEcho(4, t.trim(), false) || lineIsSlideTitleEcho(4, t.trim(), true)) continue;
    kept.push(t);
  }
  if (kept.length > 0) return kept.join("\n");
  return teacherObjectivesRaw.replace(/\r\n/g, "\n").trim();
}

/** Non-empty objective lines after verbatim normalisation (for slide 5 alignment). */
export function countTeacherObjectiveLines(teacherObjectivesRaw: string): number {
  const body = buildTeacherObjectivesSlide4Body(teacherObjectivesRaw);
  if (!body.trim()) return 0;
  return body.split("\n").filter((l) => l.trim().length > 0).length;
}

export type EarlySlideSanitizeContext = {
  subject: string;
  grade: string;
  topic: string;
  chapter?: string;
  dateStr?: string;
  /** Verbatim objectives from the lesson generator form. */
  teacherObjectives?: string;
  isAr: boolean;
};

function normLineKey(line: string): string {
  return line.replace(/\s+/g, " ").trim().toLowerCase();
}

function dedupeLinesInBody(body: string, minLen = 10): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    const t = line.trimEnd();
    if (!t.trim()) continue;
    const k = normLineKey(t);
    if (k.length >= minLen && seen.has(k)) continue;
    if (k.length >= minLen) seen.add(k);
    out.push(t);
  }
  return out.join("\n").trim();
}

function lineIsSlideTitleEcho(slideNumber1Based: number, line: string, isAr: boolean): boolean {
  const titles = isAr ? STRUCTURED_LESSON_SLIDE_TITLES_AR : STRUCTURED_LESSON_SLIDE_TITLES_EN;
  const official = titles[slideNumber1Based - 1]?.trim().toLowerCase() ?? "";
  const t = line.trim().replace(/^#+\s*/, "").toLowerCase();
  if (!t) return false;
  if (official && (t === official || t.startsWith(`${official}:`))) return true;

  const enEcho: Partial<Record<number, readonly RegExp[]>> = {
    1: [/^subject\s+grade\s+date\s*:?\s*$/i, /^(subject|grade|date)\s*:?\s*$/i],
    2: [/^starter(\s+activity)?\s*:?\s*$/i],
    3: [/^chapter\s+topic\s+and\s+sdg\s+goal\s*:?\s*$/i, /^chapter\s*:?\s*$/i, /^topic\s*:?\s*$/i, /^sdg\s*:?\s*$/i],
    4: [/^learning\s+objectives?\s*:?\s*$/i, /^objectives?\s*:?\s*$/i],
    5: [/^learning\s+outcomes?\s*:?\s*$/i, /^outcomes?\s*:?\s*$/i],
  };
  const arEcho: Partial<Record<number, readonly RegExp[]>> = {
    1: [/^(المادة والصف والتاريخ|المادة|الصف|التاريخ)\s*:?\s*$/],
    2: [/^(نشاط التمهيد|التمهيد|الاستهلال)\s*:?\s*$/],
    3: [/^(الفصل والموضوع|الفصل|الموضوع|هدف التنمية)\s*:?\s*$/],
    4: [/^(الأهداف التعليمية|أهداف التعلم|الأهداف)\s*:?\s*$/],
    5: [/^(نواتج التعلم|النواتج|مخرجات التعلم)\s*:?\s*$/],
  };
  const patterns = (isAr ? arEcho : enEcho)[slideNumber1Based] ?? [];
  return patterns.some((re) => re.test(t));
}

const LINE_CONTAMINATION_DENY: Partial<Record<number, readonly RegExp[]>> = {
  2: [
    /\blearning\s+objectives?\b/i,
    /\blearning\s+outcomes?\b/i,
    /\bsuccess\s+criteria\b/i,
    /\bsdgs?\b|\bsustainable\s+development\s+goal/i,
    /\bchapter\s*[:/]/i,
    /\bunit\s*[:/]/i,
    /\btopic\s*[:/]/i,
    /الأهداف|النواتج|معايير النجاح|أهداف التنمية|الفصل\s*:/,
  ],
  3: [
    /\blearning\s+objectives?\b/i,
    /\blearning\s+outcomes?\b/i,
    /\bsuccess\s+criteria\b/i,
    /\bstarter(\s+activity)?\b/i,
    /الأهداف|النواتج|التمهيد/,
  ],
  4: [
    /\blearning\s+outcomes?\b/i,
    /\bsuccess\s+criteria\b/i,
    /\bstarter(\s+activity)?\b/i,
    /النواتج|معايير النجاح/,
  ],
  5: [
    /\blearning\s+objectives?\b/i,
    /\bsuccess\s+criteria\b/i,
    /\bstarter(\s+activity)?\b/i,
    /الأهداف|معايير النجاح/,
  ],
};

/**
 * Post-process slides 1–5 only: strip title echoes, cross-slide leaks, duplicate lines.
 * Slides 6–13 must not call this function.
 */
export function sanitizeEarlyPptSlideBody(
  slideNumber1Based: number,
  body: string,
  ctx: EarlySlideSanitizeContext,
): string {
  if (slideNumber1Based < 1 || slideNumber1Based > 5) return body.trim();

  if (slideNumber1Based === 1) {
    return buildProgrammaticSlide1Body(ctx.grade, ctx.dateStr ?? "");
  }

  if (slideNumber1Based === 4 && ctx.teacherObjectives?.trim()) {
    return buildTeacherObjectivesSlide4Body(ctx.teacherObjectives);
  }

  const deny = LINE_CONTAMINATION_DENY[slideNumber1Based] ?? [];
  const topicLc = ctx.topic.trim().toLowerCase();
  const chapterLc = (ctx.chapter ?? "").trim().toLowerCase();
  const subjectLc = ctx.subject.trim().toLowerCase();

  const lines = body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((t) => {
      if (!t || t === "(Content unavailable for this slide.)") return false;
      if (lineIsSlideTitleEcho(slideNumber1Based, t, ctx.isAr)) return false;
      if (deny.some((re) => re.test(t))) return false;
      if (slideNumber1Based === 2) {
        if (topicLc && normLineKey(t) === topicLc) return false;
        if (topicLc && /^topic\s*[:/]/i.test(t)) return false;
        if (chapterLc && normLineKey(t) === chapterLc) return false;
      }
      if (slideNumber1Based === 4 || slideNumber1Based === 5) {
        if (topicLc && normLineKey(t) === `topic: ${topicLc}`) return false;
        if (topicLc && normLineKey(t) === topicLc && t.length < 48) return false;
      }
      if (slideNumber1Based === 1 && subjectLc && normLineKey(t) === subjectLc) return false;
      if (slideNumber1Based === 1 && /^subject\s*[:/]/i.test(t)) return false;
      return true;
    });

  return dedupeLinesInBody(lines.join("\n"));
}

/**
 * Split assembled `PPT Slide Content` into 13 bodies by canonical slide titles.
 */
export function parseDeckBodiesFromPptOutline(ppt: string, useArabicTitles: boolean): string[] | null {
  const titles = useArabicTitles ? STRUCTURED_LESSON_SLIDE_TITLES_AR : STRUCTURED_LESSON_SLIDE_TITLES_EN;
  const text = ppt.replace(/\r\n/g, "\n").trim();
  if (text.length < 40) return null;

  const bodies: string[] = [];
  let found = 0;

  for (let i = 0; i < STRUCTURED_LESSON_DECK_SLIDE_COUNT; i++) {
    const title = titles[i]!;
    const titleEsc = escapeRe(title);
    const titleRe = new RegExp(`(?:^|\\n)\\s*${titleEsc}\\s*(?=\\n|$)`, "im");
    const match = titleRe.exec(text);
    if (!match || match.index === undefined) {
      bodies.push("");
      continue;
    }
    found += 1;
    const bodyStart = match.index + match[0].length;
    let bodyEnd = text.length;
    const nextTitle = titles[i + 1];
    if (nextTitle) {
      const nextEsc = escapeRe(nextTitle);
      const nextRe = new RegExp(`(?:\\n)\\s*${nextEsc}\\s*(?=\\n|$)`, "im");
      const nextMatch = nextRe.exec(text.slice(bodyStart));
      if (nextMatch?.index !== undefined) bodyEnd = bodyStart + nextMatch.index;
    }
    bodies.push(text.slice(bodyStart, bodyEnd).trim());
  }

  if (found < 4) return null;
  return bodies;
}

/** One-line reminder per slide (English) for the single-slide user message. */
export const SINGLE_SLIDE_USER_FOCUS_EN: readonly string[] = [
  "Body: two lines only — grade value, then date value. Do NOT write the subject name, Subject/Grade/Date labels, or repeat the slide title (the title already covers subject).",
  "Starter AFL-powered activity only — teacher-selected or AI-selected tool, fully implemented (prompts, tasks, interaction), not a label. Do NOT write 'Starter Activity' inside the body. No chapter, topic, SDG, objectives, or outcomes.",
  "Exactly three items once each: chapter name, topic name, one SDG (number + title). No 'Chapter Topic and SDG Goal' heading inside the body. No objectives, outcomes, or explanations.",
  "(Slide 4 is filled from the teacher form automatically — not generated in this call.)",
  "Measurable learning outcomes ONLY — exactly one outcome per teacher objective (same count). Bloom verbs; stay within objective scope. No 'Learning Outcomes' heading in body. Do not copy objectives verbatim.",
  "Main phase: FULL core teaching content FIRST, then AFL-based activities (fully implemented classroom process). No plenary, differentiation, or exit ticket.",
  "Differentiated tasks for lower, middle, and higher achievers plus one mini plenary AFL checkpoint — aligned with lesson content. No UAE link, homework, or core re-teach.",
  "Exactly ONE link type only: UAE **or** real life **or** cross-curricular — pick the strongest only. No extra sections.",
  "Plenary: real classroom activity using teacher-selected or AI-selected Plenary AFL tool — full implementation. No homework, future references, or new teaching.",
  "Extended task or homework only — embed Extended AFL if selected or auto-selected. No plenary re-teach.",
  "Exit ticket: short focused AFL assessment only — immediate understanding check. No success criteria or homework paragraph.",
  "Success criteria and self-evaluation — embed Feedback AFL if selected or auto-selected. Help students assess their own learning. No exit ticket repeat.",
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
      ? buildSourceMaterialPromptBlock(trimmedSource.slice(0, SOURCE_MATERIAL_MAX_CHARS))
      : "";

  const lessonBlock =
    sn >= 6 && fullLessonPlan.trim().length > 0
      ? `

### Full lesson plan (continuity — do not paste unrelated sections onto this slide)
Use only what you need for this slide’s purpose. Do not copy large blocks verbatim from here unless they truly belong on this slide type.

${fullLessonPlan.trim().slice(0, 14_000)}
`
      : "";

  const teacherObjectivesVerbatim = buildTeacherObjectivesSlide4Body(input.learningObjectives);

  const slide5ObjectivesBlock =
    sn === 5
      ? `

### Teacher learning objectives (SOLE authorised basis — outcomes must not exceed this scope)
Write measurable learning outcomes that align **directly** with these objectives only — **exactly one outcome per objective** (same number of lines as objectives). Use Bloom's Taxonomy verbs; do not broaden scope beyond what the teacher wrote.

${teacherObjectivesVerbatim}
`
      : "";

  const objectivesContextLine =
    sn === 5 ? "" : `\n- Teacher-provided learning objectives / focus: ${input.learningObjectives.trim()}`;

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
- Topic (within the chapter): ${input.topic.trim()}${objectivesContextLine}${frameworkUserLine}
${sourceBlock}
${lessonBlock}
${slide5ObjectivesBlock}
${arabicExtraBlock ? `\n${arabicExtraBlock}\n` : ""}
${aflForThisSlide ? `\n${aflForThisSlide}\n` : ""}

### This slide (slide ${sn}) — required focus
${focus}
${retry}

Output markers exactly as the system prompt specifies.
`.trim();
}
