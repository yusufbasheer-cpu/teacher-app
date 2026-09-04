import type { LessonPlanInput } from "@/lib/lesson-plan";
import { usesArabicPptSlideTitles } from "@/lib/lesson-plan";
import { buildSourceMaterialPromptBlock, SOURCE_MATERIAL_MAX_CHARS } from "@/lib/lesson-plan";
import { stripOuterMarkdownFences } from "@/lib/parse-teacher-package-response";
import {
  DEFAULT_PRESENTATION_LANGUAGE,
  pptString,
  type PresentationLanguage,
} from "@/lib/ppt-language";
import {
  STRUCTURED_LESSON_DECK_SLIDE_COUNT,
  STRUCTURED_LESSON_SLIDE_TITLES_AR,
  STRUCTURED_LESSON_SLIDE_TITLES_EN,
  SLIDE_8_TITLE_LEGACY_EN,
  getStructuredLessonSlideTitle,
  getStructuredLessonSlideTitles,
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
  const rest = trimmed.slice(si + SINGLE_PPT_SLIDE_BODY_START.length).replace(/^\s*\r?\n?/, "");
  const ei = rest.toLowerCase().indexOf(SINGLE_PPT_SLIDE_BODY_END.toLowerCase());
  if (ei !== -1) return rest.slice(0, ei).trim();
  return rest.trim();
}

/**
 * Remove every line whose text (after stripping markdown heading markers) exactly matches
 * the slide title, or starts with the title followed by ":" / " —" / " -".
 * Applied globally to all 13 slides in both the extraction path and the AI-generation path
 * so the validator never sees "slide title repeated inside body".
 */
export function stripSlideTitleEchoFromBody(body: string, slideTitle: string): string {
  if (!slideTitle.trim()) return body;
  const titleLc = slideTitle.trim().toLowerCase();
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const filtered = lines.filter((line) => {
    const t = line.trim().replace(/^#+\s*/, "").toLowerCase();
    if (!t) return true;
    return !(
      t === titleLc ||
      t.startsWith(`${titleLc}:`) ||
      t.startsWith(`${titleLc} —`) ||
      t.startsWith(`${titleLc} -`)
    );
  });
  return filtered.join("\n").replace(/^\n+/, "").trim();
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

const OUTCOME_INTRO_LINE_RE =
  /^(learning\s+outcomes?|outcomes?|students\s+will\s+be\s+able\s+to)\s*:?\s*$/i;
const OUTCOME_LINE_PREFIX_RE = /^(?:\d+[.)]\s*|[-•*]\s+|\u2022\s*)/;

/** Extract one outcome per measurable line (numbered, bulleted, or standalone). */
export function extractLearningOutcomeLines(outcomesBody: string, isAr = false): string[] {
  const out: string[] = [];
  for (const raw of outcomesBody.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line || line === "(Content unavailable for this slide.)") continue;
    if (lineIsSlideTitleEcho(5, line, false) || lineIsSlideTitleEcho(5, line, isAr)) continue;
    if (OUTCOME_INTRO_LINE_RE.test(line)) continue;
    const stripped = line.replace(OUTCOME_LINE_PREFIX_RE, "").trim();
    if (!stripped) continue;
    if (stripped.length < 8) continue;
    out.push(stripped);
  }
  return out;
}

/** Slide 5: exactly one outcome per teacher objective, same order (when objectives are known). */
export function slide5OutcomesAlignWithTeacherObjectives(
  outcomesBody: string,
  teacherObjectivesRaw: string,
  isAr = false,
): boolean {
  const objectiveCount = countTeacherObjectiveLines(teacherObjectivesRaw);
  if (objectiveCount === 0) return outcomesBody.trim().length >= 24;
  const outcomeLines = extractLearningOutcomeLines(outcomesBody, isAr);
  return outcomeLines.length === objectiveCount;
}

export function slide5OutcomesValidationMessage(
  outcomesBody: string,
  teacherObjectivesRaw: string,
  isAr = false,
): string | null {
  const objectiveCount = countTeacherObjectiveLines(teacherObjectivesRaw);
  if (objectiveCount === 0) return null;
  const outcomeLines = extractLearningOutcomeLines(outcomesBody, isAr);
  if (outcomeLines.length === objectiveCount) return null;
  return `expected exactly ${objectiveCount} learning outcome(s) matching ${objectiveCount} teacher objective(s) in the same order; got ${outcomeLines.length}`;
}

/** Trim to the first N outcome lines when the model over-generates. */
export function sanitizeSlide5OutcomesBody(
  outcomesBody: string,
  teacherObjectivesRaw: string,
  isAr = false,
): string {
  const objectiveCount = countTeacherObjectiveLines(teacherObjectivesRaw);
  if (objectiveCount === 0) return outcomesBody.trim();
  const lines = extractLearningOutcomeLines(outcomesBody, isAr);
  if (lines.length <= objectiveCount) return lines.join("\n").trim();
  return lines.slice(0, objectiveCount).join("\n").trim();
}

/**
 * Join per-slide bodies into one outline string for `PPT Slide Content` storage / deck mining.
 * Each block starts with the canonical slide title line (English or Arabic per `useArabicTitles`).
 */
export function assembleFullPptFromSlideBodies(
  bodies: readonly string[],
  useArabicTitles: boolean,
  uaeFrameworkSelected = false,
): string {
  const titles = getStructuredLessonSlideTitles(useArabicTitles, uaeFrameworkSelected);
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
function titlePatternsForSlideIndex(
  slideIndex0Based: number,
  useArabicTitles: boolean,
  uaeFrameworkSelected: boolean,
): string[] {
  const primary = getStructuredLessonSlideTitle(slideIndex0Based, useArabicTitles, uaeFrameworkSelected);
  if (slideIndex0Based !== 7) return [primary];
  const legacy = useArabicTitles ? [] : [...SLIDE_8_TITLE_LEGACY_EN];
  return [...new Set([primary, ...legacy])];
}

export function parseDeckBodiesFromPptOutline(
  ppt: string,
  useArabicTitles: boolean,
  uaeFrameworkSelected = false,
): string[] | null {
  const titles = getStructuredLessonSlideTitles(useArabicTitles, uaeFrameworkSelected);
  const text = ppt.replace(/\r\n/g, "\n").trim();
  if (text.length < 40) return null;

  const bodies: string[] = [];
  let found = 0;

  for (let i = 0; i < STRUCTURED_LESSON_DECK_SLIDE_COUNT; i++) {
    const patterns = titlePatternsForSlideIndex(i, useArabicTitles, uaeFrameworkSelected);
    let match: RegExpExecArray | null = null;
    let matchedTitle = titles[i]!;
    for (const title of patterns) {
      const titleEsc = escapeRe(title);
      const titleRe = new RegExp(`(?:^|\\n)\\s*${titleEsc}\\s*(?=\\n|$)`, "im");
      const m = titleRe.exec(text);
      if (m && (match === null || m.index < match.index)) {
        match = m;
        matchedTitle = title;
      }
    }
    if (!match || match.index === undefined) {
      bodies.push("");
      continue;
    }
    found += 1;
    const bodyStart = match.index + match[0].length;
    let bodyEnd = text.length;
    const nextTitle = titles[i + 1];
    if (nextTitle) {
      const nextPatterns = titlePatternsForSlideIndex(i + 1, useArabicTitles, uaeFrameworkSelected);
      let earliestNext: number | undefined;
      for (const nt of nextPatterns) {
        const nextEsc = escapeRe(nt);
        const nextRe = new RegExp(`(?:\\n)\\s*${nextEsc}\\s*(?=\\n|$)`, "im");
        const nextMatch = nextRe.exec(text.slice(bodyStart));
        if (nextMatch?.index !== undefined) {
          const abs = bodyStart + nextMatch.index;
          if (earliestNext === undefined || abs < earliestNext) earliestNext = abs;
        }
      }
      if (earliestNext !== undefined) bodyEnd = earliestNext;
    }
    void matchedTitle;
    bodies.push(text.slice(bodyStart, bodyEnd).trim());
  }

  if (found < 4) return null;
  return bodies;
}

/** One-line reminder per slide (English) for the single-slide user message. */
export const SINGLE_SLIDE_USER_FOCUS_EN: readonly string[] = [
  "Body: two lines only — grade value, then date value. Do NOT write the subject name, Subject/Grade/Date labels, or repeat the slide title (the title already covers subject).",
  "Starter Activity — teacher-selected or AI-selected AFL tool, FULLY implemented as a classroom process. PRIMARY PURPOSE: guide students to PREDICT, INFER, or DISCOVER the upcoming lesson topic through structured thinking — not to reveal it directly. The activity must contain clues, prompts, comparisons, questions, scenarios, or observation tasks that help students reason toward the topic. Balance difficulty for the grade level. Encourage critical thinking, discussion, prediction, and analysis. Do NOT write 'Starter Activity' inside the body. Do NOT include learning objectives, outcomes, chapter explanations, or future slide references.",
  "Exactly three items once each: chapter name, topic name, one SDG (number + title). No 'Chapter, Topic and SDG Goal' heading inside the body. No objectives, outcomes, or explanations.",
  "(Slide 4 is filled from the teacher form automatically — not generated in this call.)",
  "Learning Outcomes ONLY: write exactly ONE measurable outcome per teacher objective — if the teacher entered 2 objectives write exactly 2 outcomes; if 3 objectives write exactly 3. Keep the SAME ORDER (outcome 1 aligns to objective 1, etc.). Use Bloom verbs; paraphrase into observable outcomes but do not add or remove items. No 'Learning Outcomes' heading in the body. Do not copy objectives verbatim.",
  "Main phase: FULL core teaching content FIRST, then AFL-based activities (fully implemented classroom process). No plenary, differentiation, or exit ticket.",
  "Differentiated Activity and Mini Plenary — write FOUR sections in this exact order: (1) Higher Achievers task — a challenging activity that extends thinking beyond the lesson objectives, (2) Middle Achievers task — a standard activity that directly matches the learning objective, (3) Lower Achievers task — a supported activity with scaffolding, word banks, sentence starters, or guided prompts. Then at the bottom: (4) Mini Plenary — one quick question or checkpoint for the teacher to check whole-class understanding. All four tasks must be specific to the actual topic. Do NOT add homework, success criteria, exit ticket, or a full plenary. No UAE link on this slide.",
  "SLIDE_8_PLACEHOLDER",
  "Plenary activity — write a COMPLETE, fully-implemented activity using the teacher-selected AFL plenary tool or the most appropriate one for the topic. Do NOT write 'Plenary' as the first line of the body. Start with the activity name directly (e.g. 'Think-Pair-Share', 'Exit Pass', 'Gallery Walk'). Then include: (1) clear activity objective linked to today's learning, (2) step-by-step teacher instructions with timings, (3) exactly what students must do at each step, (4) how it helps students reflect and summarise today's learning. Content must be specific to the actual topic — not generic. No homework, new teaching, or future slide references.",
  "Extended task or homework — write ONE complete, clear task that goes BEYOND the lesson content and bridges to future learning. Do NOT repeat the slide title in the body. Do NOT include any success criteria, self-evaluation, I can statements, checklist, or rating scale (those belong on slide 12 only). Structure the task with: (1) a clear task name, (2) numbered step-by-step student instructions, (3) what the finished product or output should look like, (4) a challenge extension for early finishers. Choose the most appropriate task type: research task, investigative task, creative project, or design challenge. The task must be specific to the actual topic taught.",
  "Exit ticket AFL tool: short focused assessment — immediate understanding check. No success criteria or homework paragraph.",
  "Success criteria and self-evaluation AFL tool — fully implemented. Do NOT write 'Success Criteria and Self Evaluation' or any version of the slide title inside the body. Start directly with the criteria items (e.g. 'I can…' statements, checklist, or rating scale). No exit ticket repeat.",
  "Thank you plus one short positive closing line for students — no recap or new tasks. Do NOT write 'Thank You' or the slide title inside the body.",
];

export function singleSlideUserFocusForSlide8(uaeFrameworkSelected: boolean): string {
  if (uaeFrameworkSelected) {
    return `UAE Real Life and Cross Curricular Connection — content must be SPECIFIC to the actual class topic and UAE context. Write 3–4 concise, inspection-ready paragraphs: (1) UAE Real-Life Connection — name a specific UAE example directly related to the topic (e.g. for Biology: UAE mangroves, Ghaf trees, camel adaptation, coral reef conservation; for Science/Environment: UAE sustainability goals, solar energy in Abu Dhabi, Masdar City; for any topic: UAE Vision 2031, EXPO legacy, national innovation agenda — always tie it tightly to the lesson topic). (2) Cross-Curricular Link — show how this topic connects to another subject taught in UAE schools (e.g. Mathematics, Arabic, ICT, Islamic Studies) with a concrete classroom example. (3) UAE MOE and Inspection Alignment — state clearly how teaching this topic meets UAE Ministry of Education curriculum goals and KHDA/SPEA inspection-quality standards. (4) SDG in UAE Context — name the specific Sustainable Development Goal most relevant to this topic and explain how the UAE is working toward it. Content must feel real and specific — never generic. Do not repeat the slide title in the body.`;
  }
  return `Real Life and Cross Curricular Connection — choose the ONE connection that fits the actual class topic BEST and develop it fully with specific, topic-related details (not generic statements). Write 2–3 clear paragraphs: choose from (A) Real-Life Daily Application — give a concrete, specific example of how this topic is used in everyday life; (B) Cross-Curricular Link — explain specifically how this topic connects to another school subject with a classroom example; (C) Career Connection — name 2–3 specific careers where professionals use this knowledge and explain how; (D) Global Issue or SDG — connect to a specific Sustainable Development Goal with a real-world example; (E) Subject Integration — show how Science, Math, English, or another subject uses this topic. Content must be directly relevant to the actual topic taught. Must NOT mention UAE, Emirates, Dubai, Abu Dhabi, MOE UAE, KHDA, or SPEA anywhere. Do not repeat the slide title in the body.`;
}

export const SLIDE7_HIGHER_LABEL = "Higher Achievers task" as const;
export const SLIDE7_MIDDLE_LABEL = "Middle Achievers task" as const;
export const SLIDE7_LOWER_LABEL = "Lower Achievers task" as const;

const SLIDE7_CANONICAL_LABELS = [SLIDE7_HIGHER_LABEL, SLIDE7_MIDDLE_LABEL, SLIDE7_LOWER_LABEL] as const;

type Slide7Tier = "higher" | "middle" | "lower";

const SLIDE7_MINI_PLENARY_HEADING_RE =
  /^#*\s*(mini\s+plenary|mini-plenary|mini\s+plenary\s+activity)\s*:?\s*$/i;
const SLIDE7_FULL_PLENARY_HEADING_RE = /^#*\s*plenary\s*:?\s*$/i;
const SLIDE7_QUICK_CHECK_RE = /^(quick\s+check|checkpoint)\b/i;
const SLIDE7_DISCARD_LINE_RE =
  /^(quick\s+check|checkpoint|differentiated\s+activity|success\s+criteria|exit\s+ticket|extended\s+task|homework)\b/i;
const SLIDE7_TITLE_ECHO_RE = /^#*\s*differentiated\s+activity(\s+and\s+mini\s+plenary)?\s*:?\s*$/i;

const SLIDE7_HIGHER_HEADING_RE =
  /^#*\s*(higher\s*(achiev|attain|ability|level|tier)s?(\s+task)?|extension(\s+task)?|greater\s+depth|most\s+able|gifted|أعلى)\b/i;
const SLIDE7_MIDDLE_HEADING_RE =
  /^#*\s*(middle\s*(achiev|attain|ability|level|tier)s?(\s+task)?|core(\s+group)?(\s+task)?|on[\s-]track|أوسط)\b/i;
const SLIDE7_LOWER_HEADING_RE =
  /^#*\s*(lower\s*(achiev|attain|ability|level|tier)s?(\s+task)?|support(\s+task)?|must\s*\/\s*should|less\s+support|foundation|أدنى)\b/i;

/**
 * Arabic tier headings, matched on word roots rather than the definite-article form: a real
 * heading reads "mahamma li-l-mutafawwiqin", so anchoring on "al-mutafawwiq" matched nothing
 * and every Arabic tier came back empty - which the formatter then filled with English defaults.
 */
const SLIDE7_HIGHER_HEADING_AR_RE = /(\u0645\u062a\u0641\u0648\u0642|\u0623\u0639\u0644\u0649|\u0625\u062b\u0631\u0627\u0626|\u0645\u062a\u0642\u062f\u0645)/;
const SLIDE7_MIDDLE_HEADING_AR_RE = /(\u0645\u062a\u0648\u0633\u0637|\u0623\u0648\u0633\u0637)/;
const SLIDE7_LOWER_HEADING_AR_RE = /(\u0623\u0633\u0627\u0633\u064a|\u0623\u062f\u0646\u0649|\u062f\u0639\u0645|\u0645\u0633\u0627\u0646\u062f)/;
/** Arabic heading for the mini-plenary section. */
const SLIDE7_MINI_PLENARY_AR_RE = /\u062a\u0644\u062e\u064a\u0635\s*\u0645\u0635\u063a\u0631/;

const SLIDE7_INLINE_TIER_RE =
  /^(higher|middle|lower)\s*(achiev\w*|attain\w*|ability\w*|level\w*|tier\w*)\s*(?:task\s*)?[:.\-]\s*(.+)$/i;

function classifySlide7TierLine(line: string): Slide7Tier | null {
  const t = line.trim();
  if (!t || SLIDE7_DISCARD_LINE_RE.test(t) || SLIDE7_TITLE_ECHO_RE.test(t)) return null;
  if (SLIDE7_MINI_PLENARY_HEADING_RE.test(t) || SLIDE7_FULL_PLENARY_HEADING_RE.test(t)) return null;
  if (SLIDE7_MINI_PLENARY_AR_RE.test(t)) return null;
  if (SLIDE7_QUICK_CHECK_RE.test(t)) return null;
  if (SLIDE7_HIGHER_HEADING_RE.test(t) || /^higher\s+achievers?\s+task\s*$/i.test(t)) return "higher";
  if (SLIDE7_MIDDLE_HEADING_RE.test(t) || /^middle\s+achievers?\s+task\s*$/i.test(t)) return "middle";
  if (SLIDE7_LOWER_HEADING_RE.test(t) || /^lower\s+achievers?\s+task\s*$/i.test(t)) return "lower";
  // Arabic headings are short and unanchored, so only treat a line as a tier heading when it is
  // heading-length - a long sentence that happens to contain the word is body text, not a label.
  if (t.length <= 40) {
    if (SLIDE7_HIGHER_HEADING_AR_RE.test(t)) return "higher";
    if (SLIDE7_MIDDLE_HEADING_AR_RE.test(t)) return "middle";
    if (SLIDE7_LOWER_HEADING_AR_RE.test(t)) return "lower";
  }
  return null;
}

function defaultSlide7MiniPlenary(topic: string, language: PresentationLanguage): string {
  const t = topic.trim() || (language === "ar" ? "موضوع الدرس" : "the lesson topic");
  if (language === "ar") {
    return `تحقق سريع: اشرح في جملة واحدة أهم ما تعلمته عن "${t}" اليوم.`;
  }
  return `Quick check: In one sentence, explain the most important thing you learned about "${t}" today.`;
}

function defaultSlide7TierTask(tier: Slide7Tier, topic: string, language: PresentationLanguage): string {
  const t = topic.trim() || (language === "ar" ? "موضوع الدرس" : "the lesson topic");
  if (language === "ar") {
    switch (tier) {
      case "higher":
        return `مهمة إثرائية: حلل أو قيّم أو صمّم عملاً يوظف "${t}" بعمق أكبر.`;
      case "middle":
        return `أكمل النشاط الأساسي حول "${t}" بخطوات واضحة ودليل على الفهم.`;
      case "lower":
        return `اعمل على نسخة مدعومة من "${t}" مع بدايات جمل وأمثلة محلولة.`;
    }
  }
  switch (tier) {
    case "higher":
      return `Analyse, evaluate, or design an extension challenge applying "${t}" with greater depth.`;
    case "middle":
      return `Complete the standard activity for "${t}" with clear steps and expected evidence of understanding.`;
    case "lower":
      return `Work through a scaffolded version of "${t}" with sentence starters, worked examples, or guided prompts.`;
  }
}

function parseSlide7TierBlocks(body: string): { tiers: Record<Slide7Tier, string[]>; miniPlenary: string[] } {
  const tiers: Record<Slide7Tier, string[]> = { higher: [], middle: [], lower: [] };
  const miniPlenary: string[] = [];
  let current: Slide7Tier | "miniPlenary" | null = null;

  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const t = raw.trim();
    if (!t) continue;

    if (SLIDE7_MINI_PLENARY_HEADING_RE.test(t)) {
      current = "miniPlenary";
      continue;
    }

    if (SLIDE7_FULL_PLENARY_HEADING_RE.test(t)) {
      current = null;
      continue;
    }

    const inline = t.match(SLIDE7_INLINE_TIER_RE);
    if (inline) {
      const key = inline[1]!.toLowerCase() as Slide7Tier;
      const rest = inline[3]?.trim();
      current = key;
      if (rest) tiers[key].push(rest);
      continue;
    }

    const heading = classifySlide7TierLine(t);
    if (heading) {
      current = heading;
      // Only extract inline content when there is an explicit colon separating the
      // heading label from content on the same line (e.g. "Higher Achievers task: do X").
      // Without a colon the line is a heading-only label — nothing to push; content
      // will arrive on the following lines. The previous regex approach
      // (achiev|...)s? only matched "Achiev" in "Achievers", leaving "ers task"
      // as a fragment that was incorrectly pushed into the tier.
      const colonIdx = t.indexOf(":");
      if (colonIdx !== -1) {
        const afterColon = t.slice(colonIdx + 1).trim();
        if (afterColon.length >= 8) {
          tiers[heading].push(afterColon);
        }
      }
      continue;
    }

    if (current !== "miniPlenary") {
      if (SLIDE7_DISCARD_LINE_RE.test(t) || SLIDE7_QUICK_CHECK_RE.test(t) || SLIDE7_TITLE_ECHO_RE.test(t)) {
        current = null;
        continue;
      }
      if (/\b(success\s+criteria|exit\s+ticket|homework|extended\s+task)\b/i.test(t)) {
        current = null;
        continue;
      }
      if (/\bplenary\b/i.test(t) && !/\bmini\s+plenary\b/i.test(t) && t.length > 24) {
        current = null;
        continue;
      }
    }

    if (current === "miniPlenary") {
      miniPlenary.push(t);
    } else if (current !== null) {
      tiers[current].push(t);
    }
  }

  return { tiers, miniPlenary };
}

function formatSlide7CanonicalBody(
  tiers: Record<Slide7Tier, string[]>,
  topic: string,
  miniPlenary: string[],
  language: PresentationLanguage,
): string {
  const labels: Record<Slide7Tier, string> = {
    higher: language === "ar" ? pptString(language, "slide7Higher") : SLIDE7_HIGHER_LABEL,
    middle: language === "ar" ? pptString(language, "slide7Middle") : SLIDE7_MIDDLE_LABEL,
    lower: language === "ar" ? pptString(language, "slide7Lower") : SLIDE7_LOWER_LABEL,
  };
  const order: Slide7Tier[] = ["higher", "middle", "lower"];
  const tierBody = order
    .map((tier) => {
      const content =
        tiers[tier].join("\n").trim() || defaultSlide7TierTask(tier, topic, language);
      return `${labels[tier]}\n${content}`;
    })
    .join("\n\n");
  const plenaryContent =
    miniPlenary.join("\n").trim() || defaultSlide7MiniPlenary(topic, language);
  const plenaryLabel =
    language === "ar" ? pptString(language, "slide7MiniPlenary") : "Mini Plenary";
  return `${tierBody}\n\n${plenaryLabel}\n${plenaryContent}`.trim();
}

/** Keep three tier sections with canonical labels and append a Mini Plenary checkpoint at the bottom. */
export function sanitizeSlide7DifferentiatedBody(
  body: string,
  topic = "",
  language: PresentationLanguage = DEFAULT_PRESENTATION_LANGUAGE,
): string {
  const { tiers, miniPlenary } = parseSlide7TierBlocks(body);
  return formatSlide7CanonicalBody(tiers, topic, miniPlenary, language);
}

export function validateSlide7DifferentiatedBody(body: string): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const t = body.trim();
  if (!t) return { ok: false, reasons: ["empty body"] };

  const lines = t.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);

  for (const required of SLIDE7_CANONICAL_LABELS) {
    if (!lines.some((l) => l.toLowerCase() === required.toLowerCase())) {
      reasons.push(`must include section "${required}"`);
    }
  }

  const labelCount = lines.filter((l) =>
    SLIDE7_CANONICAL_LABELS.some((label) => l.toLowerCase() === label.toLowerCase()),
  ).length;
  if (labelCount !== 3) {
    reasons.push("must contain exactly three tier section labels and no duplicates");
  }

  if (!lines.some((l) => /^mini\s+plenary\s*$/i.test(l))) {
    reasons.push('must include "Mini Plenary" checkpoint at the bottom of slide 7');
  }

  let inMiniPlenary = false;
  for (const line of lines) {
    if (/^mini\s+plenary\s*$/i.test(line)) {
      inMiniPlenary = true;
      continue;
    }

    if (inMiniPlenary) {
      // Inside Mini Plenary: only block content that belongs on other slides entirely
      if (/\b(success\s+criteria|exit\s+ticket|homework|extended\s+task)\b/i.test(line)) {
        reasons.push("forbidden content from other slides found inside Mini Plenary section");
        break;
      }
      continue;
    }

    // Before the Mini Plenary heading: enforce tier-section rules
    if (SLIDE7_FULL_PLENARY_HEADING_RE.test(line)) {
      reasons.push('forbidden standalone "Plenary" section on slide 7 — use Mini Plenary instead');
      break;
    }
    if (SLIDE7_QUICK_CHECK_RE.test(line) || /^quick\s+check\b/i.test(line)) {
      reasons.push("forbidden Quick Check before the Mini Plenary section — only three achiever tasks here");
      break;
    }
    if (/\b(success\s+criteria|exit\s+ticket|homework|extended\s+task)\b/i.test(line)) {
      reasons.push("forbidden content from other slides (success criteria, exit ticket, homework)");
      break;
    }
    if (/\bdifferentiated\s+activity\b/i.test(line) && line.length < 80) {
      reasons.push("do not repeat the slide title inside the body");
      break;
    }
  }

  const contentLines = lines.filter(
    (l) => !SLIDE7_CANONICAL_LABELS.some((label) => l.toLowerCase() === label.toLowerCase()),
  );
  if (contentLines.length < 3) {
    reasons.push("each achiever section must include task content");
  }

  return { ok: reasons.length === 0, reasons };
}

const SLIDE10_SUCCESS_CRITERIA_LINE_RE =
  /\b(success\s+criteria|self[\s-]?evaluation|self[\s-]?assessment|i\s+can\b|traffic\s+light|two\s+stars\s+and\s+a\s+wish|rating\s+scale|checklist|معايير\s+النجاح|التقييم\s+الذاتي|أستطيع\s+أن)\b/i;

const SLIDE10_FORBIDDEN_LINE_RE =
  /\b(exit\s+ticket|plenary|differentiated\s+activity|learning\s+objectives?|learning\s+outcomes?|main\s+phase|starter\s+activity)\b/i;

function lineEchoesSlideTitle(line: string, slideTitle: string): boolean {
  const lc = line.trim().toLowerCase();
  const titleLc = slideTitle.trim().toLowerCase();
  if (!titleLc) return false;
  return (
    lc === titleLc ||
    lc.startsWith(`${titleLc}:`) ||
    lc === "extended task" ||
    lc === "extended task:" ||
    lc === "homework" ||
    lc === "homework:"
  );
}

/** Extended task / homework only — no title echo, success criteria, or other slide types. */
export function sanitizeSlide10ExtendedBody(body: string, slideTitle = "Extended Task"): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  let inSuccessCriteriaBlock = false;

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) {
      if (!inSuccessCriteriaBlock && kept.length > 0 && kept[kept.length - 1] !== "") kept.push("");
      continue;
    }

    if (lineEchoesSlideTitle(t, slideTitle)) continue;
    if (/^context:/i.test(t) || /single extended task only/i.test(t) || /^السياق:/i.test(t)) continue;

    if (/^#*\s*success\s+criteria\b/i.test(t) || /^#*\s*self[\s-]?evaluation\b/i.test(t)) {
      inSuccessCriteriaBlock = true;
      continue;
    }

    if (inSuccessCriteriaBlock) {
      if (
        /^#*\s*(extended\s+task|homework|exit\s+ticket|plenary|differentiated)\b/i.test(t) ||
        classifySlide7TierLine(t)
      ) {
        inSuccessCriteriaBlock = false;
      } else {
        continue;
      }
    }

    if (SLIDE10_SUCCESS_CRITERIA_LINE_RE.test(t)) continue;
    if (SLIDE10_FORBIDDEN_LINE_RE.test(t)) continue;
    if (/^i\s+can\b/i.test(t)) continue;

    kept.push(t);
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function validateSlide10ExtendedBody(
  body: string,
  slideTitle = "Extended Task",
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const t = body.trim();
  if (!t) return { ok: false, reasons: ["empty body"] };

  const lines = t.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (lineEchoesSlideTitle(line, slideTitle)) {
      reasons.push("slide title repeated inside body");
      break;
    }
    if (SLIDE10_SUCCESS_CRITERIA_LINE_RE.test(line)) {
      reasons.push("success criteria or self-evaluation must not appear on slide 10");
      break;
    }
    if (SLIDE10_FORBIDDEN_LINE_RE.test(line)) {
      reasons.push("forbidden content from another slide type");
      break;
    }
  }

  const taskLines = lines.filter(
    (l) =>
      !lineEchoesSlideTitle(l, slideTitle) &&
      !SLIDE10_SUCCESS_CRITERIA_LINE_RE.test(l) &&
      l.length >= 12,
  );
  if (taskLines.length === 0) {
    reasons.push("must include extended task or homework content");
  }

  return { ok: reasons.length === 0, reasons };
}

export function resolveSingleSlideUserFocus(
  slideNumber1Based: number,
  uaeFrameworkSelected: boolean,
): string {
  if (slideNumber1Based === 8) return singleSlideUserFocusForSlide8(uaeFrameworkSelected);
  const base = SINGLE_SLIDE_USER_FOCUS_EN[slideNumber1Based - 1] ?? "";
  return base === "SLIDE_8_PLACEHOLDER" ? singleSlideUserFocusForSlide8(uaeFrameworkSelected) : base;
}

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
  uaeFrameworkSelected?: boolean;
  preflightChecklist?: string;
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
    uaeFrameworkSelected = false,
    preflightChecklist,
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

### Teacher learning objectives (SOLE authorised basis — outcomes must match exactly)
The teacher entered **${countTeacherObjectiveLines(input.learningObjectives)}** objective(s). Write **exactly ${countTeacherObjectiveLines(input.learningObjectives)}** learning outcome(s) — no more, no fewer — in the **same order** as below. Each outcome must correspond directly to the matching objective (1→1, 2→2, 3→3). Use Bloom's Taxonomy verbs; do not broaden scope beyond what the teacher wrote.

${teacherObjectivesVerbatim}
`
      : "";

  const objectivesContextLine =
    sn === 5 ? "" : `\n- Teacher-provided learning objectives / focus: ${input.learningObjectives.trim()}`;

  const focus = resolveSingleSlideUserFocus(sn, uaeFrameworkSelected);
  const officialTitle = getStructuredLessonSlideTitle(sn - 1, usesArabicPptSlideTitles(input.subject.trim()), uaeFrameworkSelected);

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
- **Official deck title:** ${officialTitle}
${preflightChecklist ? `\n${preflightChecklist}\n` : ""}
${focus}
${retry}

Output markers exactly as the system prompt specifies.
`.trim();
}
