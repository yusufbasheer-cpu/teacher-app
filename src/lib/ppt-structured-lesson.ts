import type { AflPhaseId, AflSelectionsPayload } from "@/lib/afl-tools";
import { AFL_PHASE_IDS, formatToolsBlockForSlide } from "@/lib/afl-tools";
import {
  type LessonPlanResult,
  getPptSourceLessonText,
  getPptSourceSlideOutline,
} from "@/lib/lesson-plan";

/** FLUX images: title, main phase, UAE links, plenary, exit ticket (0-based indices). */
export const PPT_IMAGE_SLIDE_INDEX_SET = new Set<number>([0, 5, 7, 8, 10]);

export type StructuredLessonSlideModel = {
  slideTitle: string;
  body: string;
  speakerNotes: string;
  aflCallout?: string;
  includeImageSlot: boolean;
};

const BULLET_MAX_LINES = 14;
const BULLET_MAX_LINES_WITH_AFL = 22;
const SECTION_MAX_CHARS = 3200;

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

/** Strip markdown symbols from slide body text (no asterisks, hashtags, underscores on slides). Preserves line breaks. */
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
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n");
  return s.replace(/\n{4,}/g, "\n\n\n").trim();
}

function isArabicLanguageSubject(subject: string): boolean {
  return subject.trim() === "Arabic";
}

function buildTeacherSlideNotes(suggestedTiming: string, teacherContext: string, isAr: boolean): string {
  const t = teacherContext.replace(/\s+/g, " ").trim().slice(0, 1200);
  if (isAr) {
    return `التوقيت المقترح: ${suggestedTiming}\n\nملاحظات المعلم: ${t || "اضبط حسب الحصة."}\n\nراجع خطة الدرس الكاملة للتفاصيل.`.trim();
  }
  return `Suggested timing: ${suggestedTiming}\n\nTeacher notes: ${t || "Adjust to your period length."}\n\nSee Full Lesson Plan for additional detail.`.trim();
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
  const polished = polishBody(merged, SECTION_MAX_CHARS + 600, BULLET_MAX_LINES_WITH_AFL);
  slide.body = stripMarkdownSymbolsForStudents(polished || merged);
}

/** Map teacher-selected AFL tools onto the 13-slide deck (starter, main, UAE, plenary, extended, success). */
function applyAflDeckInjections(slides: StructuredLessonSlideModel[], afl: AflSelectionsPayload | undefined) {
  if (!aflPayloadHasTools(afl) || !afl) return;
  const go = (idx: number, phase: AflPhaseId, ids?: string[]) => {
    const slide = slides[idx];
    if (!slide || !ids?.length) return;
    appendAflToSlideBody(slide, phase, ids);
  };
  go(1, "starter", afl.starter);
  go(5, "main", afl.main);
  go(7, "connections", afl.connections);
  go(8, "plenary", afl.plenary);
  go(9, "extended", afl.extended);
  go(11, "feedback", afl.feedback);
}

function applyArabicFullPlanBodyFallback(
  slides: StructuredLessonSlideModel[],
  fullPlan: string,
  isArabic: boolean,
): void {
  if (!isArabic || !fullPlan || fullPlan.length < 400) return;
  const contentSlides = slides.slice(1);
  const thin = contentSlides.filter((s) => s.body.replace(/\s+/g, "").length < 80).length;
  if (thin < 6) return;

  const paras = fullPlan
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const n = contentSlides.length;

  if (paras.length < 2) {
    const chunk = polishBody(fullPlan, SECTION_MAX_CHARS);
    for (let i = 0; i < contentSlides.length; i++) {
      const slide = slides[i + 1]!;
      if (slide.body.replace(/\s+/g, "").length < 80 && chunk) {
        slide.body = stripMarkdownSymbolsForStudents(chunk);
      }
    }
    return;
  }

  const per = Math.max(1, Math.ceil(paras.length / n));
  for (let i = 0; i < n; i++) {
    const slide = slides[i + 1]!;
    if (slide.body.replace(/\s+/g, "").length >= 120) continue;
    const text = paras.slice(i * per, (i + 1) * per).join("\n\n");
    if (text.trim()) slide.body = stripMarkdownSymbolsForStudents(polishBody(text, SECTION_MAX_CHARS));
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
  /** Teacher-selected AFL tools (e.g. Picture in Time) — used for image slots and logging, not for generic catalogue text on slides. */
  aflSelections?: AflSelectionsPayload;
};

export function buildStructuredLessonSlides(ctx: StructuredLessonPptContext): StructuredLessonSlideModel[] {
  if (aflPayloadHasTools(ctx.aflSelections)) {
    console.log("[ppt-structured-lesson] buildStructuredLessonSlides received AFL selections:", {
      starter: ctx.aflSelections?.starter?.length ?? 0,
      main: ctx.aflSelections?.main?.length ?? 0,
      connections: ctx.aflSelections?.connections?.length ?? 0,
      plenary: ctx.aflSelections?.plenary?.length ?? 0,
      extended: ctx.aflSelections?.extended?.length ?? 0,
      feedback: ctx.aflSelections?.feedback?.length ?? 0,
      ids: ctx.aflSelections,
    });
  }

  const topic = ctx.topic.trim() || "this topic";
  const subj = ctx.subject.trim();
  const gr = ctx.grade.trim();
  const plan = (ctx.fullLessonPlan || "").trim();
  const ppt = (ctx.pptContent || "").trim();
  const lo = (ctx.learningObjectivesText || "").trim();
  const hw = (ctx.homeworkTask || "").trim();
  const anchor = `Context: ${subj}, ${gr}, topic "${topic}". Ground every bullet in this lesson context.`;
  const isAr = isArabicLanguageSubject(subj);
  const contextAnchor = isAr
    ? `السياق: مادة ${subj}، الصف ${gr}، الموضوع «${topic}». اربط كل فقرة بهذا السياق التعليمي.`
    : anchor;

  const locale = isAr ? "ar-AE" : "en-GB";
  const dateStr = new Date().toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const T = isAr
    ? {
        s1: "معلومات الحصة",
        s2: "التمهيد",
        s3: "الفصل والموضوع وأهداف التنمية المستدامة",
        s4: "الأهداف التعليمية",
        s5: "نواتج التعلم",
        s6: "المرحلة الأساسية",
        s7: "نشاط متمايز (تلخيص مصغر)",
        s8: "الإمارات والحياة الواقعية والربط بين المواد",
        s9: "الختام",
        s10: "مهمة موسعة",
        s11: "بطاقة الخروج",
        s12: "معايير النجاح والتقييم الذاتي",
        s13: "شكراً",
      }
    : {
        s1: "Lesson information",
        s2: "Starter",
        s3: "Chapter, topic, and SDG",
        s4: "Learning objectives",
        s5: "Learning outcomes",
        s6: "Main phase",
        s7: "Differentiated activity (mini plenary)",
        s8: "UAE, real life, and cross-curricular links",
        s9: "Plenary",
        s10: "Extended task",
        s11: "Exit ticket",
        s12: "Success criteria (self-evaluation)",
        s13: "Thank you",
      };

  const slides: StructuredLessonSlideModel[] = [];

  // Slide 1 — Subject, Grade, Date
  slides.push({
    slideTitle: T.s1,
    body: stripMarkdownSymbolsForStudents(
      isAr ? `المادة: ${subj}\nالصف: ${gr}\nالتاريخ: ${dateStr}` : `Subject: ${subj}\nGrade: ${gr}\nDate: ${dateStr}`,
    ),
    speakerNotes: buildTeacherSlideNotes(
      "1 minute",
      isAr
        ? `افتتاحية: رحب بالطلاب، تحقق من الحضور، اعرض عنوان الدرس «${topic}».`
        : `Opening: welcome the class, mark register, display the lesson title "${topic}".`,
      isAr,
    ),
    includeImageSlot: true,
  });

  // Slide 2 — Starter (5–10 min, prior knowledge / curiosity, AFL starter tools appended later)
  const s2 = pickDeck(
    "starter",
    ["starter", "hook", "warm up", "التمهيد", "استهلال"],
    isAr
      ? `تمهيد 5–10 دقائق لموضوع «${topic}»: نشاط سريع تفاعلي قليل التجهيز يسترجع المعرفة السابقة أو يثير الفضول. اكتب النشاط كاملاً بخطوات واضحة على الشريحة.`
      : `5–10 minute starter for "${topic}": a fast, interactive, low-setup activity that retrieves prior knowledge or sparks curiosity. Write the full activity on-slide with clear steps.`,
    "5–10 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T.s2, body: s2.body, speakerNotes: s2.notes, includeImageSlot: false });

  // Slide 3 — Chapter + topic + SDG
  const s3 = pickDeck(
    "chapterTopicSdg",
    ["chapter", "unit", "sdg", "الفصل", "الوحدة"],
    isAr
      ? `اكتب اسم الفصل/الوحدة والموضوع «${topic}» واذكر هدفاً واحداً من أهداف التنمية المستدامة مرتبطاً بهذا التعلم بصياغة واضحة للطلاب.`
      : `State the chapter or unit name, the topic "${topic}", and one Sustainable Development Goal (SDG) linked to this learning in student-friendly wording.`,
    "2–3 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T.s3, body: s3.body, speakerNotes: s3.notes, includeImageSlot: false });

  // Slide 4 — Learning objectives (To understand / To explore; min 3; merge form LOs)
  const s4Pick = pickDeck(
    "learningObjectives",
    ["learning objectives", "objectives", "الأهداف", "أهداف"],
    isAr
      ? `ثلاثة أهداف تعليمية على الأقل لموضوع «${topic}» بصيغة To understand / To explore وتربط بالصورة الكبيرة للدرس.`
      : `At least 3 broad learning objectives for "${topic}" using To understand… / To explore… and the big picture of the lesson.`,
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
        ? `${contextAnchor}\nأدرج 3 أهداف على الأقل بصيغة واضحة للطلاب.`
        : `${contextAnchor}\nInclude at least 3 objectives in student-facing wording.`,
    ),
  );
  slides.push({
    slideTitle: T.s4,
    body: s4Body,
    speakerNotes: s4Pick.notes,
    includeImageSlot: false,
  });

  // Slide 5 — Learning outcomes (Bloom; Must/Should/Could or Bronze/Silver/Gold; min 3 per band)
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
  slides.push({ slideTitle: T.s5, body: s5.body, speakerNotes: s5.notes, includeImageSlot: false });

  // Slide 6 — Main phase (I Do / We Do / You Do)
  const s6 = pickDeck(
    "mainPhase",
    ["main phase", "main teaching", "i do", "we do", "you do", "المرحلة الأساسية", "شرح"],
    isAr
      ? `المرحلة الأساسية لموضوع «${topic}»: I Do (نمذجة المعلم بخطوات)، We Do (تطبيق مرشد)، You Do (تطبيق مستقل). اكتب المحتوى الفعلي لكل جزء.`
      : `Main phase for "${topic}": I Do (teacher modelling with steps), We Do (guided practice), You Do (independent practice). Write concrete content for each.`,
    "25–35 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T.s6, body: s6.body, speakerNotes: s6.notes, includeImageSlot: true });

  // Slide 7 — Differentiated activity (mini plenary): Support / Core / Extension
  const s7 = pickDeck(
    "differentiated",
    ["differentiation", "mini plenary", "support", "extension", "التمايز", "تلخيص"],
    isAr
      ? `ثلاثة مسارات لموضوع «${topic}»: دعم (LA) مع تدعيم وبنوك مفردات وخطوات مبسطة لذوي الحاجات وEAL، أساسي (MA) بمستوى الصف، توسعة (HA) بتفكير عليا وحل مسائل. اكتب مهمة واضحة لكل مسار.`
      : `Three on-slide tasks for "${topic}": Support (LA) with scaffolding, word bank, simplified steps for SEND/EAL; Core (MA) at grade expectation; Extension (HA) with higher-order thinking. Specific wording for each.`,
    "10–12 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T.s7, body: s7.body, speakerNotes: s7.notes, includeImageSlot: false });

  // Slide 8 — UAE, real life, cross-curricular, career
  const s8 = pickDeck(
    "uaeCrossCurricular",
    ["uae", "cross curricular", "real life", "career", "sdg", "الإمارات", "الربط"],
    isAr
      ? `اربط «${topic}» بمعلم أو قيمة من الإمارات، وهدف تنمية مستدامة، وربط مع مادة أخرى، وتطبيق مهني واقعي — بصياغة محددة للطلاب.`
      : `Link "${topic}" to a specific UAE context or value, an SDG, a cross-curricular subject, and a real-life career application — concrete on-slide text.`,
    "5–7 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T.s8, body: s8.body, speakerNotes: s8.notes, includeImageSlot: true });

  // Slide 9 — Plenary (reflection / ticket to leave / quiz + AFL plenary tools later)
  const s9 = pickDeck(
    "plenary",
    ["plenary", "reflection", "summary", "quiz", "الختام", "تلخيص"],
    isAr
      ? `ختام لموضوع «${topic}»: مهمة تأمل أو بطاقة خروج أو اختبار سريع يتحقق من تحقيق نواتج التعلم. اكتب المهمة كاملة للطلاب.`
      : `Plenary for "${topic}": a reflection task OR ticket to leave OR short quiz that checks learning outcomes. Full student-facing task.`,
    "8–10 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T.s9, body: s9.body, speakerNotes: s9.notes, includeImageSlot: true });

  // Slide 10 — Extended task (merge homework field)
  const s10Pick = pickDeck(
    "extendedTask",
    ["extended task", "homework", "early finisher", "الواجب", "توسعة"],
    isAr
      ? `مهمة موسعة لموضوع «${topic}» تتعمق لا تزيد العمل فقط، تربط هذا الدرس بالقادم، وتتطلب بحثاً مستقلاً أو تطبيقاً إبداعياً.`
      : `Extended task for "${topic}" that deepens learning (not just more work), bridges to the next lesson, and requires independent research or creative application.`,
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
        ? `${contextAnchor}\nصِغ مهمة موسعة واضحة المعايير.`
        : `${contextAnchor}\nWrite a rich extended task with clear success criteria.`,
    ),
  );
  slides.push({
    slideTitle: T.s10,
    body: s10Body,
    speakerNotes: s10Pick.notes,
    includeImageSlot: false,
  });

  // Slide 11 — Exit ticket
  const s11 = pickDeck(
    "exitTicket",
    ["exit ticket", "ticket to leave", "closure", "بطاقة الخروج"],
    isAr
      ? `بطاقة خروج قصيرة لموضوع «${topic}» مرتبطة بنواتج التعلم: 3-2-1، أو سؤال اختيار من متعدد، أو ورقة دقيقة (أهم ما تعلمت). اكتب التعليمات كاملة.`
      : `Short exit ticket for "${topic}" tied to learning outcomes: 3-2-1, one MCQ, or a one-minute paper (most important learning). Full instructions on-slide.`,
    "3–5 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T.s11, body: s11.body, speakerNotes: s11.notes, includeImageSlot: true });

  // Slide 12 — Success criteria / self-evaluation
  const s12 = pickDeck(
    "successCriteria",
    ["success criteria", "self-evaluation", "i can", "معايير النجاح"],
    isAr
      ? `معايير نجاح لموضوع «${topic}»: جمل تبدأ بـ «أستطيع أن…» مع مقياس (إشارات مرور أو قبضة إلى خمسة) ليقيّم الطلاب ثقتهم بكل معيار.`
      : `Success criteria for "${topic}": I can… statements with a simple scale (traffic lights or fist-to-five) for students to rate confidence per statement.`,
    "3–4 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T.s12, body: s12.body, speakerNotes: s12.notes, includeImageSlot: false });

  // Slide 13 — Thank you + pack away
  slides.push({
    slideTitle: T.s13,
    body: stripMarkdownSymbolsForStudents(
      isAr
        ? `شكراً لجهدكم اليوم في درس «${topic}».\nقبل المغادرة: راجع مكتبك، أعد الدفاتر، التقط أي ورق متسرب، واجلس جاهزاً للتعليمات التالية.`
        : `Thank you for your hard work today on "${topic}".\nBefore you leave: check your desk for litter, return notebooks and equipment, line up quietly when dismissed.`,
    ),
    speakerNotes: buildTeacherSlideNotes(
      "1–2 minutes",
      isAr
        ? `اختتام إيجابي، تأكد من التنظيم قبل انتقال الفصل.`
        : `Positive close; ensure pack-away routines before transition.`,
      isAr,
    ),
    includeImageSlot: false,
  });

  applyArabicFullPlanBodyFallback(slides, plan, isAr);
  applyAflDeckInjections(slides, ctx.aflSelections);

  if (aflPayloadHasTools(ctx.aflSelections)) {
    const bodies = slides.map((s, i) => ({ i, title: s.slideTitle, chars: s.body.trim().length }));
    console.log("[ppt-structured-lesson] Slide body lengths (deck built):", bodies);
  }

  return slides;
}

/** Map FLUX image URLs to slide indices (order of orderedUrls must match imageSlideIndices). */
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

/** Maps five FLUX slots to slides 0, 5, 7, 8, 10 (title, main phase, UAE links, plenary, exit ticket). */
export function mapFourImagesToDeck(
  deckLength: number,
  orderedUrls: (string | null)[],
): (string | null)[] {
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
