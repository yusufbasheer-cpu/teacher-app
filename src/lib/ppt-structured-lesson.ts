import type { AflPhaseId, AflSelectionsPayload } from "@/lib/afl-tools";
import { AFL_PHASE_IDS, distributeIds, formatToolsBlockForSlide, getAflToolById } from "@/lib/afl-tools";
import {
  type LessonPlanResult,
  getPptSourceLessonText,
  getPptSourceSlideOutline,
} from "@/lib/lesson-plan";

/** 0-based slide indices that may include one AI image each (max 4 per deck). */
export const PPT_IMAGE_SLIDE_INDEX_SET = new Set<number>([0, 4, 6, 12]);

export type StructuredLessonSlideModel = {
  slideTitle: string;
  body: string;
  speakerNotes: string;
  aflCallout?: string;
  includeImageSlot: boolean;
};

const BULLET_MAX_LINES = 14;
/** Extra lines when AFL tool blocks are appended so lesson bullets are not truncated away. */
const BULLET_MAX_LINES_WITH_AFL = 24;
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
const STOP_STARTER = [
  "prior knowledge",
  "main teaching",
  "entry ticket",
  "diagnostic",
  "mini plenary",
  "التعلم السابق",
  "عرض المعلم",
  "الشرح",
  "المرحلة الأساسية",
  "التشخيص",
];
const STOP_PRIOR = [
  "main teaching",
  "teaching phase",
  "guided practice",
  "الشرح",
  "التدريس",
  "المرحلة الأساسية",
  "التطبيق المرشد",
];
const STOP_MAIN = [
  "guided practice",
  "group activity",
  "ccl",
  "differentiation",
  "التطبيق المرشد",
  "العمل الجماعي",
  "التعلم التعاوني",
  "التمايز",
];
const STOP_GUIDED = [
  "group activity",
  "ccl",
  "collaborative",
  "differentiation",
  "العمل الجماعي",
  "التعلم التعاوني",
  "التمايز",
];
const STOP_GROUP = [
  "differentiation",
  "afl",
  "assessment for learning",
  "mini plenary",
  "التمايز",
  "التقويم",
  "تقويم التعلم",
  "التلخيص المختصر",
];
const STOP_DIFF = [
  "afl",
  "assessment for learning",
  "mini plenary",
  "exit ticket",
  "التقويم",
  "تقويم التعلم",
  "التلخيص",
  "بطاقة الخروج",
];
const STOP_AFL = [
  "mini plenary",
  "exit ticket",
  "homework",
  "plenary",
  "التلخيص المختصر",
  "بطاقة الخروج",
  "الواجب",
  "الختام",
];
const STOP_MINI = [
  "exit ticket",
  "homework",
  "extended task",
  "plenary",
  "بطاقة الخروج",
  "الواجب",
  "الواجب المنزلي",
  "الختام",
];
const STOP_EXIT = [
  "homework",
  "extended task",
  "plenary",
  "reflection",
  "الواجب",
  "الواجب المنزلي",
  "الختام",
  "التأمل",
];
const STOP_HOME = ["plenary", "reflection", "summary", "الختام", "التأمل", "التلخيص"];
const STOP_PLENARY: string[] = [];

const extractors = {
  objectives: (plan: string) =>
    extractByHints(plan, ["learning objectives", "learning objective", "الأهداف التعليمية", "أهداف التعلم", "الأهداف", "الهداف"], STOP_OBJECTIVES) ||
    extractByHints(plan, ["success criteria", "معايير النجاح"], STOP_STARTER),
  starter: (plan: string) =>
    extractByHints(plan, ["starter activity", "starter", "hook", "التمهيد", "الاستهلال", "نشاط البداية"], STOP_STARTER),
  prior: (plan: string) =>
    extractByHints(plan, ["prior knowledge", "entry ticket", "diagnostic", "التعلم السابق", "المعرفة القبلية", "التشخيص"], STOP_PRIOR),
  main: (plan: string) =>
    extractByHints(plan, ["main teaching", "main phase", "teaching phase", "الشرح", "عرض المعلم", "التدريس", "المرحلة الأساسية"], STOP_MAIN),
  guided: (plan: string) =>
    extractByHints(plan, ["guided practice", "guided instruction", "we do", "التطبيق المرشد", "الممارسة مع المعلم"], STOP_GUIDED),
  group: (plan: string) =>
    extractByHints(
      plan,
      [
        "classroom collaborative learning",
        "collaborative learning",
        "ccl",
        "group activity",
        "group task",
        "التعلم التعاوني",
        "العمل الجماعي",
        "نشاط المجموعات",
      ],
      STOP_GROUP,
    ),
  diff: (plan: string) =>
    extractByHints(plan, ["differentiation", "support for", "challenge task", "sen", "التمايز", "التنويع", "دعم الطلبة"], STOP_DIFF),
  afl: (plan: string) =>
    extractByHints(plan, ["assessment for learning", "afl", "questioning strategies", "تقويم التعلم", "التقويم"], STOP_AFL),
  mini: (plan: string) =>
    extractByHints(plan, ["mini plenary", "quick check", "understanding check", "التلخيص المختصر", "فحص سريع"], STOP_MINI),
  exit: (plan: string) =>
    extractByHints(plan, ["exit ticket", "closure", "بطاقة الخروج", "الإغلاق"], STOP_EXIT),
  homework: (plan: string) =>
    extractByHints(plan, ["homework", "extended task", "take-home", "الواجب المنزلي", "الواجب", "مهمة البيت"], STOP_HOME),
  plenary: (plan: string) =>
    extractByHints(plan, ["plenary", "reflection", "summary activity", "self-assessment", "الختام", "التأمل", "التلخيص"], STOP_PLENARY),
};

function extractFromFullPlan(fullPlan: string, kind: keyof typeof extractors): string {
  return extractors[kind](fullPlan);
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

const AFL_GENERAL =
  "Rotate: cold calling, mini whiteboards, think-pair-share, thumbs up/down, peer assessment, hinge questions, and exit tickets.";

const AFL_GENERAL_AR =
  "تنويع: أسئلة عشوائية، السبورة الصغيرة، فكر-زاوج-شارك، إبهام لأعلى/أسفل، تقويم الأقران، أسئلة مفصلية، وبطاقة خروج.";

function isArabicLanguageSubject(subject: string): boolean {
  return subject.trim() === "Arabic";
}

function buildNotes(topic: string, phase: string, aflCallout?: string, isArabic?: boolean): string {
  if (isArabic) {
    const core = phase.trim() || `قيادة حصة حول «${topic}» مع فحوص واضحة للفهم.`;
    const box = aflCallout ? `\n\nمقترح للتقويم في هذه الشريحة: ${aflCallout}` : "";
    return `${core}${box}\n\n${AFL_GENERAL_AR}\n\nاضبط التوقيت والمجموعات بما يتوافق مع خطة الدرس الكاملة المحفوظة.`;
  }
  const core = phase.trim() || `Facilitate ${topic} with clear checks for understanding.`;
  const box = aflCallout ? `\n\nSuggested AFL on this slide: ${aflCallout}` : "";
  return `${core}${box}\n\nBroader AFL toolkit: ${AFL_GENERAL}\n\nAlign timing and grouping with your saved Full Lesson Plan.`;
}

function aflPayloadHasTools(afl: AflSelectionsPayload | undefined): boolean {
  if (!afl) return false;
  return AFL_PHASE_IDS.some((p) => (afl[p]?.length ?? 0) > 0);
}

function appendAflToSlideBody(
  slide: StructuredLessonSlideModel,
  phase: AflPhaseId,
  ids: string[] | undefined,
) {
  const block = formatToolsBlockForSlide(phase, ids);
  if (!block) return;
  const base = (slide.body ?? "").trim();
  const merged = `${base}${block}`.trim();
  const polished = polishBody(merged, SECTION_MAX_CHARS + 800, BULLET_MAX_LINES_WITH_AFL);
  slide.body = polished || merged.slice(0, SECTION_MAX_CHARS + 800).trim() || base;
}

/**
 * Map selected tools onto the 13-slide deck (indices):
 * 0 title, 1 objectives, 2 starter, 3 prior/entry, 4–7 main family, 8 AFL/feedback,
 * 9 mini plenary, 10 exit, 11 homework, 12 plenary.
 */
function applyAflToolInjections(slides: StructuredLessonSlideModel[], afl: AflSelectionsPayload | undefined) {
  if (!aflPayloadHasTools(afl) || !afl) return;

  const append = (slideIndex: number, phase: AflPhaseId, ids?: string[]) => {
    const slide = slides[slideIndex];
    if (!slide || !ids?.length) return;
    appendAflToSlideBody(slide, phase, ids);
  };

  // Starter tools → Starter slide
  append(2, "starter", afl.starter);
  // Making connections → prior/entry; short reminder on first main teaching slide
  append(3, "connections", afl.connections);
  const connIds = afl.connections;
  if (connIds?.length) {
    const mainSlide = slides[4];
    if (mainSlide) {
      const labels = connIds
        .map((id) => getAflToolById(id)?.label)
        .filter((x): x is string => Boolean(x && x.trim()));
      if (labels.length) {
        const reminder = `\n\n— Making connections —\n${labels.map((l) => `• ${l}`).join("\n")}\n(See Prior Knowledge slide for how to use each tool.)`;
        const merged = `${(mainSlide.body ?? "").trim()}${reminder}`.trim();
        mainSlide.body =
          polishBody(merged, SECTION_MAX_CHARS + 600, BULLET_MAX_LINES_WITH_AFL) ||
          merged.slice(0, SECTION_MAX_CHARS + 600).trim();
      }
    }
  }

  const mainIds = afl.main ?? [];
  if (mainIds.length > 0) {
    const parts = distributeIds(mainIds, 5);
    const mainSlideIndices = [4, 5, 6, 7, 9];
    parts.forEach((chunk, i) => append(mainSlideIndices[i]!, "main", chunk));
  }

  append(8, "feedback", afl.feedback);
  // Extended-task picks → Homework slide
  append(11, "extended", afl.extended);
  append(12, "plenary", afl.plenary);
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
      if (slide.body.replace(/\s+/g, "").length < 80 && chunk) slide.body = chunk;
    }
    return;
  }

  const per = Math.max(1, Math.ceil(paras.length / n));
  for (let i = 0; i < n; i++) {
    const slide = slides[i + 1]!;
    if (slide.body.replace(/\s+/g, "").length >= 120) continue;
    const text = paras.slice(i * per, (i + 1) * per).join("\n\n");
    if (text.trim()) slide.body = polishBody(text, SECTION_MAX_CHARS);
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
  /** Teacher-selected AFL tools to append to matching slide bodies. */
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
  const teacher = (ctx.teacherName || "Teacher").trim() || "Teacher";
  const plan = (ctx.fullLessonPlan || "").trim();
  const ppt = (ctx.pptContent || "").trim();
  const lo = (ctx.learningObjectivesText || "").trim();
  const hw = (ctx.homeworkTask || "").trim();
  const anchor = `Context: ${subj}, ${gr}, topic "${topic}". Ground every bullet in this lesson context.`;
  const isAr = isArabicLanguageSubject(subj);
  const contextAnchor = isAr
    ? `السياق: مادة ${subj}، الصف ${gr}، الموضوع «${topic}». اربط كل فقرة بهذا السياق التعليمي.`
    : anchor;

  const T = isAr
    ? {
        title: "معلومات الدرس",
        objectives: "الأهداف التعليمية",
        starter: "نشاط التمهيد",
        prior: "دخول الحصة — التعلم السابق",
        main: "عرض المعلم — الشرح",
        guided: "التطبيق المرشد",
        group: "العمل التعاوني",
        diff: "التمايز",
        afl: "التقويم أثناء التعلم",
        mini: "التلخيص المختصر",
        exit: "بطاقة الخروج",
        homework: "الواجب المنزلي",
        plenary: "الختام والتأمل",
      }
    : {
        title: "Lesson Title",
        objectives: "Learning Objectives",
        starter: "Starter Activity",
        prior: "Entry Ticket — Prior Knowledge",
        main: "Main Teaching Phase",
        guided: "Guided Practice",
        group: "Group Activity",
        diff: "Differentiation",
        afl: "AFL Tools in This Lesson",
        mini: "Mini Plenary",
        exit: "Exit Ticket",
        homework: "Homework",
        plenary: "Plenary & Reflection",
      };

  const pick = (
    kind: keyof typeof extractors,
    pptHints: string[],
    topicFallback: string,
    afl?: string,
  ) => {
    const fromPlan = plan ? extractFromFullPlan(plan, kind) : "";
    const fromPpt = ppt ? extractFromPptContent(ppt, pptHints) : "";
    const body = mergeBodies(fromPlan, fromPpt, `${contextAnchor}\n${topicFallback}`);
    return { body, notes: buildNotes(topic, fromPlan || fromPpt, afl, isAr), afl };
  };

  const slides: StructuredLessonSlideModel[] = [];

  // 0 Title — body lists meta; image optional
  slides.push({
    slideTitle: T.title,
    body: isAr
      ? [`المادة: ${subj}`, `الصف: ${gr}`, `الموضوع: ${topic}`, `المعلم: ${teacher}`].join("\n")
      : [`Subject: ${subj}`, `Grade: ${gr}`, `Topic: ${topic}`, `Teacher: ${teacher}`].join("\n"),
    speakerNotes: isAr
      ? `رحب بالطلاب في موضوع «${topic}» لمادة ${subj}.\n\nتقويم سريع قبل الأهداف: إظهار اليد أو خريطة ذهنية لدقيقة واحدة حول «${topic}».\n\n${AFL_GENERAL_AR}`
      : `Welcome learners to ${topic} in ${subj}.\n\nAFL: quick prior scan — show of hands or one-minute mind-map on "${topic}" before objectives.\n\n${AFL_GENERAL}`,
    aflCallout: isAr
      ? "مسح سريع: إبهام لأعلى إن سمعت بهذا الموضوع من قبل."
      : "Prior scan: thumbs up/down if you have heard of this topic before.",
    includeImageSlot: true,
  });

  // 1 Learning objectives
  const objPick = pick(
    "objectives",
    ["learning objectives", "objectives", "الأهداف", "أهداف"],
    isAr
      ? `صِغ أهدافًا ذكية وقابلة للقياس لموضوع «${topic}».`
      : `State SMART objectives for ${topic}.`,
    isAr ? "سبورة صغيرة: كلمة مفتاحية لكل هدف." : "Mini whiteboard: one keyword per objective.",
  );
  const objBody = mergeBodies(
    lo,
    objPick.body,
    isAr
      ? `${contextAnchor}\nاذكر 3–5 أهدافًا قابلة للقياس لموضوع «${topic}» في مادة ${subj} (${gr}).`
      : `${contextAnchor}\nList 3–5 measurable objectives for ${topic} in ${subj} (${gr}).`,
  );
  slides.push({
    slideTitle: T.objectives,
    body: objBody,
    speakerNotes: objPick.notes,
    aflCallout: isAr ? "سبورة صغيرة: يكتب الطلاب مؤشر نجاح واحد." : "Mini whiteboard: students write one success indicator.",
    includeImageSlot: false,
  });

  const sStarter = pick(
    "starter",
    ["starter", "hook", "engage", "التمهيد", "استهلال"],
    isAr
      ? `تمهيد لموضوع «${topic}»: سؤال مثير أو محفز قصير.`
      : `Starter hook for ${topic}: puzzling question or short stimulus.`,
    isAr ? "فكر-زاوج-شارك" : "Think-pair-share",
  );
  slides.push({
    slideTitle: T.starter,
    body: sStarter.body,
    speakerNotes: sStarter.notes,
    aflCallout: isAr ? "فكر-زاوج-شارك بعد التمهيد." : "Think–pair–share after the hook.",
    includeImageSlot: false,
  });

  const sPrior = pick(
    "prior",
    ["prior", "entry", "diagnostic", "قبلي", "سابق"],
    isAr ? `أسئلة عن المعرفة السابقة بخصوص «${topic}».` : `Prior-knowledge questions about ${topic}.`,
    isAr ? "أسئلة عشوائية" : "Cold calling",
  );
  slides.push({
    slideTitle: T.prior,
    body: sPrior.body,
    speakerNotes: sPrior.notes,
    aflCallout: isAr ? "أسئلة عشوائية مع وقت انتظار بعد كل سؤال." : "Cold calling with wait time after each question.",
    includeImageSlot: false,
  });

  const sMain = pick(
    "main",
    ["main teaching", "explanation", "i do", "شرح", "عرض"],
    isAr ? `تسلسل شرح خطوة بخطوة لموضوع «${topic}».` : `Step-by-step teaching sequence for ${topic}.`,
    isAr ? "أسئلة عشوائية وفحوص" : "Cold calling + checks",
  );
  slides.push({
    slideTitle: T.main,
    body: sMain.body,
    speakerNotes: sMain.notes,
    aflCallout: isAr ? "استخدم أسئلة مفصلية كل 3–5 دقائق." : "Use hinge questions every 3–5 minutes.",
    includeImageSlot: true,
  });

  const sGuided = pick(
    "guided",
    ["guided", "we do", "مرشد", "تطبيق"],
    isAr
      ? `تطبيق مرشد لموضوع «${topic}» — حل نموذجي معًا.`
      : `Guided practice for ${topic} — work a sample together.`,
    isAr ? "تقويم الأقران" : "Peer assessment",
  );
  slides.push({
    slideTitle: T.guided,
    body: sGuided.body,
    speakerNotes: sGuided.notes,
    aflCallout: isAr ? "مراجعة الأقران لأول خطوة حل." : "Peer check of first solution step.",
    includeImageSlot: false,
  });

  const sGroup = pick(
    "group",
    ["group", "collaborative", "ccl", "جماعي", "تعاوني"],
    isAr
      ? `مهمة جماعية حول «${topic}» بأدوار واضحة ومنتج نهائي.`
      : `Collaborative task on ${topic} with clear roles and a product.`,
    isAr ? "فكر-زاوج-شارك" : "Think-pair-share",
  );
  slides.push({
    slideTitle: T.group,
    body: sGroup.body,
    speakerNotes: sGroup.notes,
    aflCallout: isAr ? "جولة معرض أو متحدث من كل مجموعة." : "Gallery walk or reporter from each group.",
    includeImageSlot: true,
  });

  const sDiff = pick(
    "diff",
    ["differentiation", "support", "challenge", "تمايز", "دعم"],
    isAr ? `مسارات دعم وتحدي لموضوع «${topic}».` : `Support and stretch paths for ${topic}.`,
    isAr ? "إبهام لأعلى/أسفل" : "Thumbs up/down",
  );
  slides.push({
    slideTitle: T.diff,
    body: sDiff.body,
    speakerNotes: sDiff.notes,
    aflCallout: isAr
      ? "إبهام لأعلى/أسفل عن الثقة قبل العمل المستقل."
      : "Thumbs up/down on confidence before independent work.",
    includeImageSlot: false,
  });

  const sAfl = pick(
    "afl",
    ["afl", "formative", "questioning", "تقويم"],
    isAr ? `أساليب تقويمية لهذا الدرس حول «${topic}».` : `Formative moves for this lesson on ${topic}.`,
    isAr ? "تنويع في التقويم" : "Mixed AFL",
  );
  slides.push({
    slideTitle: T.afl,
    body: sAfl.body,
    speakerNotes: sAfl.notes,
    aflCallout: isAr ? "تناوب: سؤال عشوائي، فكر-زاوج-شارك، سبورات." : "Rotate: cold call, TPS, whiteboards.",
    includeImageSlot: false,
  });

  const sMini = pick(
    "mini",
    ["mini plenary", "check", "تلخيص", "فحص"],
    isAr ? `فحص سريع للفهم بخصوص «${topic}».` : `Quick understanding check on ${topic}.`,
    isAr ? "سؤال شفهي ختامي" : "Exit-style oral",
  );
  slides.push({
    slideTitle: T.mini,
    body: sMini.body,
    speakerNotes: sMini.notes,
    aflCallout: isAr ? "سؤال مفصلي واحد للجميع." : "One hinge question to whole class.",
    includeImageSlot: false,
  });

  const sExit = pick(
    "exit",
    ["exit ticket", "closure", "خروج", "إغلاق"],
    isAr ? `أسئلة خروج متوافقة مع أهداف «${topic}».` : `Exit questions aligned to ${topic} objectives.`,
    isAr ? "بطاقة خروج" : "Exit ticket",
  );
  slides.push({
    slideTitle: T.exit,
    body: sExit.body,
    speakerNotes: sExit.notes,
    aflCallout: isAr ? "بطاقة خروج كتابية (سؤالان كحد أقصى)." : "Written exit ticket (2 questions max).",
    includeImageSlot: false,
  });

  const hwBody = mergeBodies(
    hw,
    pick("homework", ["homework", "assignment", "واجب", "منزلي"], isAr ? `توسعة واجب لموضوع «${topic}».` : `Homework extension for ${topic}.`).body,
    isAr
      ? `${contextAnchor}\nتمرين موسع أو بحث قصير حول «${topic}».`
      : `${contextAnchor}\nExtended practice or research on ${topic}.`,
  );
  slides.push({
    slideTitle: T.homework,
    body: hwBody,
    speakerNotes: buildNotes(
      topic,
      hw || ppt,
      isAr ? "معايير النجاح ظاهرة على السبورة / LMS." : "Success criteria visible on board / LMS.",
      isAr,
    ),
    aflCallout: isAr ? "مراجعة الأقران للمعايير قبل المغادرة." : "Peer review of criteria before leaving.",
    includeImageSlot: false,
  });

  const sPlen = pick(
    "plenary",
    ["plenary", "reflection", "summary", "ختام", "تلخيص"],
    isAr ? `تلخيص وتأمل لموضوع «${topic}».` : `Summary and reflection for ${topic}.`,
    isAr ? "تقويم ذاتي" : "Self-assessment",
  );
  slides.push({
    slideTitle: T.plenary,
    body: sPlen.body,
    speakerNotes: sPlen.notes,
    aflCallout: isAr ? "يقيّم الطلاب ثقتهم 1–4 في أهداف اليوم." : "Students rate confidence 1–4 on today's objectives.",
    includeImageSlot: true,
  });

  applyArabicFullPlanBodyFallback(slides, plan, isAr);
  applyAflToolInjections(slides, ctx.aflSelections);

  if (aflPayloadHasTools(ctx.aflSelections)) {
    const bodies = slides.map((s, i) => ({ i, title: s.slideTitle, chars: s.body.trim().length }));
    console.log("[ppt-structured-lesson] Slide body lengths after AFL merge:", bodies);
  }

  return slides;
}

/** Map four FAL results onto the 13-slide deck (null on slides without images). */
export function mapFourImagesToDeck(
  deckLength: number,
  orderedUrls: (string | null)[],
): (string | null)[] {
  const imageIndices = [...PPT_IMAGE_SLIDE_INDEX_SET].sort((a, b) => a - b);
  const out: (string | null)[] = Array.from({ length: deckLength }, () => null);
  for (let i = 0; i < imageIndices.length && i < orderedUrls.length; i++) {
    const idx = imageIndices[i]!;
    if (idx < deckLength) out[idx] = orderedUrls[i] ?? null;
  }
  return out;
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
