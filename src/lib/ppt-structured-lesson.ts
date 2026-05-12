import type { AflPhaseId, AflSelectionsPayload } from "@/lib/afl-tools";
import { AFL_PHASE_IDS, formatToolsBlockForSlide } from "@/lib/afl-tools";
import {
  type LessonPlanResult,
  getPptSourceLessonText,
  getPptSourceSlideOutline,
} from "@/lib/lesson-plan";

/** Exactly 13 slides in the lesson deck (asserted when building). */
export const STRUCTURED_LESSON_DECK_SLIDE_COUNT = 13 as const;

/**
 * FLUX images only on slides 1, 2, 6, and 9 (1-based) → zero-based indices 0, 1, 5, 8.
 * Maximum four images per export.
 */
export const PPT_IMAGE_SLIDE_INDEX_SET = new Set<number>([0, 1, 5, 8]);

export type StructuredLessonSlideModel = {
  slideTitle: string;
  body: string;
  speakerNotes: string;
  aflCallout?: string;
  includeImageSlot: boolean;
};

const BULLET_MAX_LINES = 14;
const BULLET_MAX_LINES_WITH_AFL = 18;
const SECTION_MAX_CHARS = 3200;

/** Per-slide caps after merge + AFL: keep each slide self-contained (no overflow slides). */
const SLIDE_BODY_LIMIT: readonly { chars: number; lines: number }[] = [
  { chars: 420, lines: 8 },
  { chars: 2600, lines: 18 },
  { chars: 1700, lines: 14 },
  { chars: 1900, lines: 14 },
  { chars: 2800, lines: 18 },
  { chars: 3000, lines: 20 },
  { chars: 2700, lines: 18 },
  { chars: 1900, lines: 14 },
  { chars: 2700, lines: 18 },
  { chars: 2300, lines: 16 },
  { chars: 1700, lines: 14 },
  { chars: 2300, lines: 16 },
  { chars: 900, lines: 12 },
];

function truncateBody(s: string, maxLines: number): string {
  const lines = s.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length <= maxLines) return lines.join("\n").trim();
  return lines.slice(0, maxLines).join("\n").trim();
}

function polishBody(raw: string, maxChars: number, maxLines: number = BULLET_MAX_LINES): string {
  const t = raw.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!t) return "";
  const cap = t.length > maxChars ? `${t.slice(0, maxChars).trim()}…` : t;
  return truncateBody(cap, maxLines);
}

function linesOfPlan(plan: string): string[] {
  return plan.replace(/\r\n/g, "\n").split("\n");
}

function findHeadingLine(lines: string[], needles: string[], startAt = 0): number {
  const lowered = needles.map((n) => n.toLowerCase());
  for (let i = startAt; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const stripped = raw
      .replace(/^#+\s*/, "")
      .replace(/^\*{0,2}\s*/, "")
      .replace(/\*{0,2}\s*$/, "")
      .trim();
    const lc = stripped.toLowerCase();
    if (!lc) continue;
    for (const n of lowered) {
      if (lc === n || lc.startsWith(`${n}:`) || lc.startsWith(`${n} —`) || lc.startsWith(`${n} -`)) {
        return i;
      }
      if (n.length <= 48 && lc.startsWith(n)) return i;
    }
  }
  return -1;
}

function captureBlockFrom(lines: string[], startLine: number, stopNeedles: string[]): string {
  if (startLine < 0 || startLine >= lines.length) return "";
  const body: string[] = [];
  const stopLower = stopNeedles.map((s) => s.toLowerCase());
  for (let i = startLine + 1; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const stripped = raw.replace(/^#+\s*/, "").trim();
    const lc = stripped.toLowerCase().replace(/^#+\s*/, "");
    let boundary = false;
    for (const s of stopLower) {
      if (s.length < 3) continue;
      if (lc === s || (lc.startsWith(s) && stripped.length < 100)) {
        boundary = true;
        break;
      }
    }
    if (boundary) break;
    body.push(raw);
  }
  return polishBody(body.join("\n"), SECTION_MAX_CHARS);
}

function extractByHints(fullPlan: string, hints: string[], stopNeedles: string[]): string {
  const lines = linesOfPlan(fullPlan);
  const idx = findHeadingLine(lines, hints, 0);
  if (idx === -1) return "";
  return captureBlockFrom(lines, idx, stopNeedles);
}

const STOP_OBJECTIVES = [
  "success criteria",
  "starter",
  "starter activity",
  "prior knowledge",
  "main teaching",
  "lesson",
  "معايير النجاح",
  "التمهيد",
  "الاستهلال",
  "نشاط البداية",
  "التعلم السابق",
  "المرحلة الأساسية",
];

const asStop = (xs: readonly string[]) => [...xs];

const DECK_STOP_STARTER = asStop([
  "learning objectives",
  "learning objective",
  "learning outcomes",
  "chapter",
  "unit",
  "main teaching",
  "main phase",
  "الأهداف",
  "النواتج",
  "الفصل",
  "المرحلة الأساسية",
]);
const DECK_STOP_CHAPTER = asStop([
  "learning objectives",
  "learning objective",
  "learning outcomes",
  "starter activity",
  "main teaching",
  "main phase",
  "الأهداف",
  "النواتج",
  "المرحلة الأساسية",
]);
const DECK_STOP_LO = asStop([
  "learning outcomes",
  "success criteria",
  "main teaching",
  "main phase",
  "starter activity",
  "النواتج",
  "معايير النجاح",
  "المرحلة الأساسية",
]);
const DECK_STOP_OUTCOMES = asStop([
  "main teaching",
  "main phase",
  "i do",
  "differentiation",
  "differentiated",
  "mini plenary",
  "uae",
  "cross curricular",
  "المرحلة الأساسية",
  "التمايز",
  "الإمارات",
]);
const DECK_STOP_MAIN = asStop([
  "differentiation",
  "differentiated",
  "support",
  "challenge",
  "mini plenary",
  "uae",
  "cross curricular",
  "real life",
  "التمايز",
  "الربط",
  "الإمارات",
]);
const DECK_STOP_DIFF = asStop([
  "uae",
  "cross curricular",
  "cross-curricular",
  "plenary",
  "real life",
  "career",
  "sdg",
  "sustainable development",
  "extended task",
  "الإمارات",
  "الختام",
  "الربط",
]);
const DECK_STOP_UAE = asStop([
  "plenary",
  "reflection",
  "extended task",
  "homework",
  "exit ticket",
  "الختام",
  "الواجب",
  "بطاقة الخروج",
]);
const DECK_STOP_PLENARY = asStop([
  "extended task",
  "homework",
  "exit ticket",
  "early finisher",
  "success criteria",
  "self-evaluation",
  "الواجب",
  "بطاقة الخروج",
  "معايير النجاح",
]);
const DECK_STOP_EXTENDED = asStop([
  "exit ticket",
  "success criteria",
  "self-evaluation",
  "thank you",
  "plenary",
  "بطاقة الخروج",
  "معايير النجاح",
]);
const DECK_STOP_EXIT = asStop([
  "success criteria",
  "self-evaluation",
  "thank you",
  "references",
  "معايير النجاح",
]);
const DECK_STOP_SUCCESS = asStop(["thank you", "references", "homework collection", "الشكر", "المراجع"]);

const deckExtractors = {
  starter: (plan: string) =>
    extractByHints(
      plan,
      ["starter activity", "starter", "hook", "engage", "warm up", "التمهيد", "الاستهلال", "نشاط البداية"],
      DECK_STOP_STARTER,
    ),
  chapterTopicSdg: (plan: string) =>
    extractByHints(
      plan,
      [
        "chapter",
        "unit",
        "topic overview",
        "sdg",
        "sustainable development",
        "big picture",
        "الفصل",
        "الوحدة",
        "أهداف التنمية المستدامة",
      ],
      DECK_STOP_CHAPTER,
    ),
  learningObjectives: (plan: string) =>
    extractByHints(
      plan,
      [
        "learning objectives",
        "learning objective",
        "lesson objectives",
        "الأهداف التعليمية",
        "أهداف التعلم",
        "الأهداف",
      ],
      DECK_STOP_LO,
    ),
  learningOutcomes: (plan: string) =>
    extractByHints(
      plan,
      [
        "learning outcomes",
        "intended outcomes",
        "must should could",
        "bronze silver gold",
        "students will be able",
        "النواتج",
        "مخرجات التعلم",
      ],
      DECK_STOP_OUTCOMES,
    ),
  mainPhase: (plan: string) => {
    const block = extractByHints(
      plan,
      ["main phase", "main teaching", "teaching sequence", "lesson development", "المرحلة الأساسية", "عرض المعلم"],
      DECK_STOP_MAIN,
    );
    if (block.trim()) return block;
    const iDo = extractByHints(plan, ["i do", "teacher model", "teacher demonstration"], DECK_STOP_MAIN);
    const weDo = extractByHints(plan, ["we do", "guided practice", "التطبيق المرشد"], DECK_STOP_MAIN);
    const youDo = extractByHints(plan, ["you do", "independent practice", "التطبيق المستقل"], DECK_STOP_MAIN);
    return [iDo, weDo, youDo].filter(Boolean).join("\n\n").trim();
  },
  differentiated: (plan: string) => {
    const d = extractByHints(
      plan,
      ["differentiation", "differentiated", "support challenge", "sen", "eal", "التمايز", "التنويع"],
      DECK_STOP_DIFF,
    );
    const m = extractByHints(plan, ["mini plenary", "quick check", "التلخيص المختصر"], DECK_STOP_DIFF);
    return [d, m].filter(Boolean).join("\n\n").trim();
  },
  uaeCrossCurricular: (plan: string) =>
    extractByHints(
      plan,
      [
        "uae",
        "cross curricular",
        "cross-curricular",
        "real life",
        "career",
        "authentic",
        "الإمارات",
        "الربط",
        "الحياة الواقعية",
      ],
      DECK_STOP_UAE,
    ),
  plenary: (plan: string) =>
    extractByHints(
      plan,
      ["plenary", "lesson closure", "reflection", "summary activity", "الختام", "التأمل", "التلخيص"],
      DECK_STOP_PLENARY,
    ),
  extendedTask: (plan: string) =>
    extractByHints(
      plan,
      [
        "extended task",
        "homework",
        "early finisher",
        "take-home",
        "stretch",
        "الواجب المنزلي",
        "الواجب",
        "مهمة موسعة",
      ],
      DECK_STOP_EXTENDED,
    ),
  exitTicket: (plan: string) =>
    extractByHints(plan, ["exit ticket", "ticket to leave", "closure task", "بطاقة الخروج", "إغلاق"], DECK_STOP_EXIT),
  successCriteria: (plan: string) =>
    extractByHints(
      plan,
      ["success criteria", "self-evaluation", "self assessment", "i can", "معايير النجاح", "التقييم الذاتي"],
      DECK_STOP_SUCCESS,
    ),
};

function extractFromFullPlanDeck(fullPlan: string, kind: keyof typeof deckExtractors): string {
  return deckExtractors[kind](fullPlan);
}

function extractFromPptContent(ppt: string, needles: string[]): string {
  const lower = ppt.toLowerCase();
  for (const h of needles) {
    const needle = h.toLowerCase();
    const pos = lower.indexOf(needle);
    if (pos === -1) continue;
    return polishBody(ppt.slice(pos, pos + 2800), SECTION_MAX_CHARS);
  }
  return "";
}

function mergeBodies(primary: string, secondary: string, topicLine: string): string {
  const a = primary.trim();
  const b = secondary.trim();
  if (a && b && a !== b) return polishBody(`${a}\n\n${b}`, SECTION_MAX_CHARS);
  if (a) return a;
  if (b) return b;
  return polishBody(topicLine, 800);
}

/**
 * Student-facing cleanup: no markdown symbols, no hyphen/en-dash bullets at line start.
 * Preserves line breaks.
 */
function stripMarkdownSymbolsForStudents(text: string): string {
  if (!text) return "";
  let s = text
    .replace(/\r\n/g, "\n")
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1");
  s = s
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t]+/g, " ")
        .replace(/^[\s]*(?:[-–—]|\*+)\s+/, "")
        .trimEnd(),
    )
    .join("\n");
  return s.replace(/\n{4,}/g, "\n\n\n").trim();
}

function isArabicLanguageSubject(subject: string): boolean {
  return subject.trim() === "Arabic";
}

function buildTeacherSlideNotes(suggestedTiming: string, teacherContext: string, isAr: boolean): string {
  const t = teacherContext.replace(/\s+/g, " ").trim().slice(0, 1100);
  if (isAr) {
    return [
      `التوقيت المقترح: ${suggestedTiming}`,
      "",
      "نصائح التقديم: صغ التعليمات، راقب التقدم في المهمة، استخدم وقت انتظار قصير بعد الأسئلة، انتقل للخطوة التالية عندما يكون أغلب الطلاب جاهزين.",
      "",
      `ملاحظات المعلم: ${t || "اضبط حسب الحصة."}`,
    ]
      .join("\n")
      .trim();
  }
  return [
    `Suggested timing: ${suggestedTiming}`,
    "",
    "Delivery tips: give crisp instructions, scan the room while students work, use brief wait time after questions, and only advance when most learners are ready.",
    "",
    `Teacher notes: ${t || "Adjust to your period length."}`,
  ]
    .join("\n")
    .trim();
}

function pickDeck(
  kind: keyof typeof deckExtractors,
  pptHints: string[],
  topicFallback: string,
  suggestedTiming: string,
  isAr: boolean,
  plan: string,
  ppt: string,
  contextAnchor: string,
): { body: string; notes: string } {
  const fromPlan = plan ? extractFromFullPlanDeck(plan, kind) : "";
  const fromPpt = ppt ? extractFromPptContent(ppt, pptHints) : "";
  const bodyRaw = mergeBodies(fromPlan, fromPpt, `${contextAnchor}\n${topicFallback}`);
  const body = stripMarkdownSymbolsForStudents(bodyRaw);
  const notes = buildTeacherSlideNotes(
    suggestedTiming,
    `${fromPlan || fromPpt || topicFallback}`.replace(/\s+/g, " ").trim(),
    isAr,
  );
  return { body, notes };
}

function aflPayloadHasTools(afl: AflSelectionsPayload | undefined): boolean {
  if (!afl) return false;
  return AFL_PHASE_IDS.some((p) => (afl[p]?.length ?? 0) > 0);
}

function appendAflToSlideBody(slide: StructuredLessonSlideModel, phase: AflPhaseId, ids?: string[]) {
  const block = formatToolsBlockForSlide(phase, ids);
  if (!block) return;
  const merged = `${(slide.body ?? "").trim()}${block}`.trim();
  const polished = polishBody(merged, SECTION_MAX_CHARS + 400, BULLET_MAX_LINES_WITH_AFL);
  slide.body = stripMarkdownSymbolsForStudents(polished || merged);
}

/** Rule 7: Starter AFL only on slide 2 (index 1); Plenary AFL only on slide 9 (index 8). */
function applyAflDeckInjections(slides: StructuredLessonSlideModel[], afl: AflSelectionsPayload | undefined) {
  if (!aflPayloadHasTools(afl) || !afl) return;
  const go = (idx: number, phase: AflPhaseId, ids?: string[]) => {
    const slide = slides[idx];
    if (!slide || !ids?.length) return;
    appendAflToSlideBody(slide, phase, ids);
  };
  go(1, "starter", afl.starter);
  go(8, "plenary", afl.plenary);
}

function clampSlideBodyToDeckRules(slides: StructuredLessonSlideModel[]): void {
  for (let i = 0; i < slides.length; i++) {
    const lim = SLIDE_BODY_LIMIT[i] ?? { chars: 2200, lines: 14 };
    const maxLines = i === 1 || i === 8 ? BULLET_MAX_LINES_WITH_AFL : BULLET_MAX_LINES;
    slides[i]!.body = stripMarkdownSymbolsForStudents(
      polishBody(slides[i]!.body ?? "", lim.chars, Math.min(maxLines, lim.lines)),
    );
  }
}

export type StructuredLessonPptContext = {
  subject: string;
  grade: string;
  topic: string;
  teacherName: string;
  learningObjectivesText?: string;
  fullLessonPlan?: string;
  pptContent?: string;
  homeworkTask?: string;
  aflSelections?: AflSelectionsPayload;
};

const SLIDE_TITLES_EN: readonly string[] = [
  "Title Slide",
  "Starter",
  "Chapter and Topic with SDG Goal",
  "Learning Objectives",
  "Learning Outcomes",
  "Main Phase",
  "Differentiated Activity with Mini Plenary",
  "UAE Real Life and Cross Curricular Link",
  "Plenary",
  "Extended Task",
  "Exit Ticket",
  "Success Criteria Self Evaluation",
  "Thank You Slide",
];

const SLIDE_TITLES_AR: readonly string[] = [
  "شريحة العنوان",
  "التمهيد",
  "الفصل والموضوع وهدف التنمية المستدامة",
  "الأهداف التعليمية",
  "نواتج التعلم",
  "المرحلة الأساسية",
  "نشاط متمايز مع تلخيص مصغر",
  "الإمارات والحياة الواقعية والربط بين المواد",
  "الختام",
  "مهمة موسعة",
  "بطاقة الخروج",
  "معايير النجاح والتقييم الذاتي",
  "شريحة الشكر",
];

/**
 * Builds exactly thirteen lesson slides: fixed order, fixed titles, topic-specific bodies,
 * speaker notes with timing and delivery tips, AFL only on slides 2 and 9, images only on 1, 2, 6, 9.
 */
export function buildStructuredLessonSlides(ctx: StructuredLessonPptContext): StructuredLessonSlideModel[] {
  if (aflPayloadHasTools(ctx.aflSelections)) {
    console.log("[ppt-structured-lesson] AFL on deck (starter → slide 2, plenary → slide 9):", {
      starter: ctx.aflSelections?.starter?.length ?? 0,
      plenary: ctx.aflSelections?.plenary?.length ?? 0,
    });
  }

  const topic = ctx.topic.trim() || "this topic";
  const subj = ctx.subject.trim();
  const gr = ctx.grade.trim();
  const plan = (ctx.fullLessonPlan || "").trim();
  const ppt = (ctx.pptContent || "").trim();
  const lo = (ctx.learningObjectivesText || "").trim();
  const hw = (ctx.homeworkTask || "").trim();
  const anchor = `Context: ${subj}, ${gr}, topic "${topic}". Ground every line in this lesson context.`;
  const isAr = isArabicLanguageSubject(subj);
  const contextAnchor = isAr
    ? `السياق: مادة ${subj}، الصف ${gr}، الموضوع «${topic}». اربط كل سطر بهذا السياق.`
    : anchor;

  const locale = isAr ? "ar-AE" : "en-GB";
  const dateStr = new Date().toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const T = isAr ? SLIDE_TITLES_AR : SLIDE_TITLES_EN;

  const slides: StructuredLessonSlideModel[] = [];

  slides.push({
    slideTitle: T[0]!,
    body: stripMarkdownSymbolsForStudents(
      isAr ? `المادة: ${subj}\nالصف: ${gr}\nالتاريخ: ${dateStr}` : `Subject: ${subj}\nGrade: ${gr}\nDate: ${dateStr}`,
    ),
    speakerNotes: buildTeacherSlideNotes(
      "1 minute",
      isAr
        ? `افتتاحية: رحب بالطلاب، راجع الحضور، اعرض عنوان الدرس «${topic}» على اللوح دون إدراجه في نص هذه الشريحة.`
        : `Opening: welcome the class, mark the register, display the lesson title "${topic}" on the board (title line is not repeated on this slide body).`,
      isAr,
    ),
    includeImageSlot: true,
  });

  const s2 = pickDeck(
    "starter",
    ["starter", "hook", "warm up", "التمهيد", "استهلال"],
    isAr
      ? `تمهيد 5–10 دقائق لموضوع «${topic}»: نشاط خطاف سريع تفاعلي قليل التجهيز يشغل الانتباه أو يسترجع معرفة سابقة. اكتب النشاط كاملاً بخطوات واضحة على الشريحة.`
      : `5–10 minute hook starter for "${topic}": fast, interactive, minimal setup; one concrete activity with clear on-slide steps for learners.`,
    "5–10 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T[1]!, body: s2.body, speakerNotes: s2.notes, includeImageSlot: true });

  const s3 = pickDeck(
    "chapterTopicSdg",
    ["chapter", "unit", "sdg", "الفصل", "الوحدة"],
    isAr
      ? `اكتب اسم الفصل والموضوع «${topic}» واذكر هدف التنمية المستدامة (رقم واسم) المرتبط بهذا التعلم بصياغة واضحة للطلاب.`
      : `Chapter name, topic "${topic}", and one specific Sustainable Development Goal (number and title) linked to this learning, in student-friendly wording.`,
    "2–3 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T[2]!, body: s3.body, speakerNotes: s3.notes, includeImageSlot: false });

  const s4Pick = pickDeck(
    "learningObjectives",
    ["learning objectives", "objectives", "الأهداف", "أهداف"],
    isAr
      ? `ثلاثة أهداف على الأقل لموضوع «${topic}» بصيغة To understand / To explore وتركز على الصورة الكبيرة للدرس.`
      : `At least 3 objectives for "${topic}" using To understand… and/or To explore…; big-picture lesson intention only on this slide.`,
    "3–4 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  const s4Body = stripMarkdownSymbolsForStudents(
    mergeBodies(
      lo,
      s4Pick.body,
      isAr
        ? `${contextAnchor}\nأدرج 3 أهداف على الأقل بصياغة للطلاب.`
        : `${contextAnchor}\nInclude at least 3 objectives in student-facing wording.`,
    ),
  );
  slides.push({ slideTitle: T[3]!, body: s4Body, speakerNotes: s4Pick.notes, includeImageSlot: false });

  const s5 = pickDeck(
    "learningOutcomes",
    ["learning outcomes", "must should", "bronze silver", "النواتج"],
    isAr
      ? `ثلاثة نواتج على الأقل لكل مستوى (Must / Should / Could أو Bronze / Silver / Gold) بأفعال قابلة للقياس من تصنيف بلوم، كلها خاصة بموضوع «${topic}».`
      : `At least 3 measurable outcomes per band (Must / Should / Could OR Bronze / Silver / Gold) using Bloom verbs, all specific to "${topic}".`,
    "3–4 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T[4]!, body: s5.body, speakerNotes: s5.notes, includeImageSlot: false });

  const s6 = pickDeck(
    "mainPhase",
    ["main phase", "main teaching", "i do", "we do", "you do", "المرحلة الأساسية", "شرح"],
    isAr
      ? `المرحلة الأساسية لموضوع «${topic}» مقسمة حصراً إلى: I Do (نمذجة المعلم بخطوات)، We Do (تطبيق مرشد)، You Do (تطبيق مستقل). محتوى حقيقي لكل جزء.`
      : `Main phase for "${topic}" split strictly into: I Do (teacher modelling with steps), We Do (guided practice), You Do (independent practice). Concrete content for each on this slide only.`,
    "25–35 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T[5]!, body: s6.body, speakerNotes: s6.notes, includeImageSlot: true });

  const s7 = pickDeck(
    "differentiated",
    ["differentiation", "mini plenary", "support", "extension", "التمايز", "تلخيص"],
    isAr
      ? `لموضوع «${topic}»: Support وCore وExtension بمهام واضحة، مع تلخيص مصغر سريع للتحقق من الفهم في نهاية الشريحة.`
      : `For "${topic}": Support, Core, and Extension tasks with clear wording, plus one short mini plenary check at the end of this slide only.`,
    "10–12 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T[6]!, body: s7.body, speakerNotes: s7.notes, includeImageSlot: false });

  const s8 = pickDeck(
    "uaeCrossCurricular",
    ["uae", "cross curricular", "real life", "الإمارات", "الربط"],
    isAr
      ? `اربط «${topic}» بسياق من الإمارات، ثم تطبيق في الحياة الواقعية، ثم ربط مع مادة أخرى. ثلاثة فقرات واضحة على هذه الشريحة فقط.`
      : `On this slide only: UAE connection for "${topic}", real-life application, and one cross-curricular link to another subject. Three distinct, concrete blocks.`,
    "5–7 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T[7]!, body: s8.body, speakerNotes: s8.notes, includeImageSlot: false });

  const s9 = pickDeck(
    "plenary",
    ["plenary", "reflection", "summary", "quiz", "الختام", "تلخيص"],
    isAr
      ? `ختام لموضوع «${topic}»: تلخيص نهائي أو بطاقة خروج أو نشاط قصير يغلق الدرس. المهمة كاملة للطلاب على هذه الشريحة.`
      : `Plenary for "${topic}": final wrap-up, ticket to leave, or short closing task. Full student-facing instructions on this slide only.`,
    "8–10 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T[8]!, body: s9.body, speakerNotes: s9.notes, includeImageSlot: true });

  const s10Pick = pickDeck(
    "extendedTask",
    ["extended task", "homework", "early finisher", "الواجب", "توسعة"],
    isAr
      ? `مهمة موسعة لموضوع «${topic}» للمنزل أو للمتقدمين: أعمق من نسخ إضافي، تربط بالدرس القادم، وتتطلب بحثاً مختصراً أو تطبيقاً إبداعياً.`
      : `Extended task for "${topic}" for home learning or early finishers: deeper than extra copying, bridges to the next lesson, needs short research or creative application.`,
    "2 minutes in class + independent time",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  const s10Body = stripMarkdownSymbolsForStudents(
    mergeBodies(
      hw,
      s10Pick.body,
      isAr
        ? `${contextAnchor}\nصِغ مهمة واحدة واضحة المعايير.`
        : `${contextAnchor}\nOne clear task with success criteria on this slide only.`,
    ),
  );
  slides.push({ slideTitle: T[9]!, body: s10Body, speakerNotes: s10Pick.notes, includeImageSlot: false });

  const s11 = pickDeck(
    "exitTicket",
    ["exit ticket", "ticket to leave", "closure", "بطاقة الخروج"],
    isAr
      ? `بطاقة خروج قصيرة لموضوع «${topic}» مرتبطة بالنواتج: سؤال أو اثنان أو 3-2-1. تعليمات كاملة على هذه الشريحة.`
      : `Exit ticket for "${topic}" tied to outcomes: one or two quick questions or a 3-2-1. Full instructions on this slide only.`,
    "3–5 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T[10]!, body: s11.body, speakerNotes: s11.notes, includeImageSlot: false });

  const s12 = pickDeck(
    "successCriteria",
    ["success criteria", "self-evaluation", "i can", "معايير النجاح"],
    isAr
      ? `معايير نجاح لموضوع «${topic}»: جمل أستطيع أن… مع مقياس (إشارات مرور أو قبضة إلى خمسة) للتقييم الذاتي مقابل نواتج التعلم.`
      : `Success criteria for "${topic}": I can… statements and a simple scale (traffic lights or fist-to-five) so students self-evaluate against the learning outcomes.`,
    "3–4 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T[11]!, body: s12.body, speakerNotes: s12.notes, includeImageSlot: false });

  slides.push({
    slideTitle: T[12]!,
    body: stripMarkdownSymbolsForStudents(
      isAr
        ? `شكراً لكم.\nقبل المغادرة: راجع مكتبك وأعد الأدوات بصمت.`
        : `Thank you.\nBefore you leave: tidy your desk and return materials quietly.`,
    ),
    speakerNotes: buildTeacherSlideNotes(
      "1–2 minutes",
      isAr
        ? `اختتام بسيط وإيجابي؛ راجع روتين المغادرة.`
        : `Simple positive close; reinforce exit routine.`,
      isAr,
    ),
    includeImageSlot: false,
  });

  applyAflDeckInjections(slides, ctx.aflSelections);
  clampSlideBodyToDeckRules(slides);

  if (slides.length !== STRUCTURED_LESSON_DECK_SLIDE_COUNT) {
    console.error(
      "[ppt-structured-lesson] Deck length invariant failed:",
      slides.length,
      "expected",
      STRUCTURED_LESSON_DECK_SLIDE_COUNT,
    );
  }

  return slides;
}

export function mapLessonPptImagesToDeck(
  deckLength: number,
  imageSlideIndices: readonly number[],
  orderedUrls: (string | null)[],
): (string | null)[] {
  const out: (string | null)[] = Array.from({ length: deckLength }, () => null);
  for (let i = 0; i < imageSlideIndices.length && i < orderedUrls.length; i++) {
    const idx = imageSlideIndices[i]!;
    if (idx >= 0 && idx < deckLength) out[idx] = orderedUrls[i] ?? null;
  }
  return out;
}

/** Maps four FLUX URLs to slides 1, 2, 6, 9 (indices 0, 1, 5, 8). */
export function mapFourImagesToDeck(deckLength: number, orderedUrls: (string | null)[]): (string | null)[] {
  const imageIndices = [...PPT_IMAGE_SLIDE_INDEX_SET].sort((a, b) => a - b);
  return mapLessonPptImagesToDeck(deckLength, imageIndices, orderedUrls);
}

export function buildLessonPlanContextFromResult(
  plan: LessonPlanResult,
  meta: {
    subject: string;
    grade: string;
    topic: string;
    teacherName: string;
    learningObjectives?: string;
    aflSelections?: AflSelectionsPayload;
  },
): StructuredLessonPptContext {
  const fullLessonText = getPptSourceLessonText(plan);
  const pptOutlineText = getPptSourceSlideOutline(plan);

  return {
    subject: meta.subject,
    grade: meta.grade,
    topic: meta.topic,
    teacherName: meta.teacherName,
    learningObjectivesText: (() => {
      const fromMeta = meta.learningObjectives?.trim();
      if (fromMeta) return fromMeta;
      if (!fullLessonText) return undefined;
      const extracted = extractByHints(
        fullLessonText,
        [
          "learning objectives",
          "learning objective",
          "الأهداف التعليمية",
          "أهداف التعلم",
          "الأهداف",
        ],
        STOP_OBJECTIVES,
      ).trim();
      return extracted || undefined;
    })(),
    fullLessonPlan: fullLessonText || undefined,
    pptContent: pptOutlineText || undefined,
    homeworkTask: typeof plan["Homework Task"] === "string" ? plan["Homework Task"] : undefined,
    ...(aflPayloadHasTools(meta.aflSelections) ? { aflSelections: meta.aflSelections } : {}),
  };
}
