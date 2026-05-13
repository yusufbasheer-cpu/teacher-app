import type { AflPhaseId, AflSelectionsPayload } from "@/lib/afl-tools";
import { AFL_PHASE_IDS, formatToolsBlockForSlide } from "@/lib/afl-tools";
import {
  type LessonPlanResult,
  getPptSourceLessonText,
  getPptSourceSlideOutline,
} from "@/lib/lesson-plan";

/** Exactly thirteen slides; single instructional purpose per slide; no overflow slides. */
export const STRUCTURED_LESSON_DECK_SLIDE_COUNT = 13 as const;

/** FLUX images only on slides 2, 6, and 9 (1-based) → indices 1, 5, 8. Slide 1 is text-only. */
export const PPT_IMAGE_SLIDE_INDEX_SET = new Set<number>([1, 5, 8]);

export type StructuredLessonSlideModel = {
  slideTitle: string;
  body: string;
  speakerNotes: string;
  aflCallout?: string;
  includeImageSlot: boolean;
};

const BULLET_MAX_LINES = 16;
const BULLET_MAX_LINES_WITH_AFL = 22;
const SECTION_MAX_CHARS = 4000;

/** Per-slide caps: rich content allowed; still one physical slide (export truncates tail if needed). */
const SLIDE_BODY_LIMIT: readonly { chars: number; lines: number }[] = [
  { chars: 220, lines: 4 },
  { chars: 3400, lines: 22 },
  { chars: 1200, lines: 12 },
  { chars: 2200, lines: 16 },
  { chars: 2600, lines: 18 },
  { chars: 4800, lines: 26 },
  { chars: 3600, lines: 22 },
  { chars: 1600, lines: 14 },
  { chars: 3400, lines: 22 },
  { chars: 2800, lines: 18 },
  { chars: 1200, lines: 12 },
  { chars: 2600, lines: 18 },
  { chars: 420, lines: 6 },
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
  uaeOnly: (plan: string) =>
    extractByHints(
      plan,
      ["uae connection", "uae context", "uae link", "united arab emirates", "national identity", "الإمارات", "الهوية"],
      DECK_STOP_UAE,
    ),
  realLifeOnly: (plan: string) =>
    extractByHints(
      plan,
      ["real life", "real world", "real-life", "authentic context", "everyday application", "الحياة الواقعية"],
      DECK_STOP_UAE,
    ),
  crossOnly: (plan: string) =>
    extractByHints(
      plan,
      ["cross curricular", "cross-curricular", "cross curricular link", "another subject", "الربط بين المواد"],
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
    return polishBody(ppt.slice(pos, pos + 3200), SECTION_MAX_CHARS);
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

/** Timing plus one short teacher focus line only (no filler tips). */
function buildTeacherSlideNotes(suggestedTiming: string, teacherFocusOneLine: string, isAr: boolean): string {
  const t = teacherFocusOneLine.replace(/\s+/g, " ").trim().slice(0, 600);
  if (isAr) {
    return [`التوقيت المقترح: ${suggestedTiming}`, `تركيز المعلم: ${t || "اضبط حسب الحصة."}`].join("\n").trim();
  }
  return [`Suggested timing: ${suggestedTiming}`, `Teacher focus: ${t || "Adjust to your period length."}`]
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

const MIN_SINGLE_LINK_CHARS = 72;

/** Slide 8: exactly one of UAE, real life, or cross-curricular — longest substantive extract wins. */
function pickSingleContextualLink(
  plan: string,
  ppt: string,
  topic: string,
  subj: string,
  gr: string,
  isAr: boolean,
  contextAnchor: string,
  suggestedTiming: string,
): { body: string; notes: string } {
  type Key = "uae" | "realLife" | "cross";
  const fromPlan = (k: Key) => {
    if (!plan) return "";
    if (k === "uae") return extractFromFullPlanDeck(plan, "uaeOnly");
    if (k === "realLife") return extractFromFullPlanDeck(plan, "realLifeOnly");
    return extractFromFullPlanDeck(plan, "crossOnly");
  };
  const fromPptBlocks: Record<Key, string> = {
    uae: ppt ? extractFromPptContent(ppt, ["uae", "emirates", "الإمارات"]) : "",
    realLife: ppt ? extractFromPptContent(ppt, ["real life", "real world", "الحياة"]) : "",
    cross: ppt ? extractFromPptContent(ppt, ["cross curricular", "cross-curricular", "الربط"]) : "",
  };
  const merged = (k: Key) =>
    stripMarkdownSymbolsForStudents(mergeBodies(fromPlan(k), fromPptBlocks[k], "").trim());

  const scored: { key: Key; text: string; len: number }[] = (["uae", "realLife", "cross"] as const).map((key) => {
    const text = merged(key);
    return { key, text, len: text.replace(/\s+/g, "").length };
  });
  scored.sort((a, b) => b.len - a.len);
  const best = scored.find((s) => s.len >= MIN_SINGLE_LINK_CHARS) ?? scored[0]!;
  let body = best.text;
  if (body.replace(/\s+/g, "").length < MIN_SINGLE_LINK_CHARS) {
    body = stripMarkdownSymbolsForStudents(
      isAr
        ? `ربط واحد فقط: اربط «${topic}» بمادة أخرى أو سياق واقعي أو قيمة من الإمارات في فقرة واحدة واضحة من خطة الدرس.`
        : `Single link only: one clear paragraph for "${topic}" (${subj}, ${gr}) choosing either a UAE connection, a real-life application, or one cross-curricular subject link from your lesson plan.`,
    );
  }
  const notes = buildTeacherSlideNotes(
    suggestedTiming,
    isAr
      ? `هذه الشريحة لربط واحد فقط (${best.key === "uae" ? "الإمارات" : best.key === "realLife" ? "حياة واقعية" : "ربط بين المواد"}).`
      : `This slide holds one link type only (${best.key === "uae" ? "UAE" : best.key === "realLife" ? "real life" : "cross-curricular"}).`,
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
  const polished = polishBody(merged, SECTION_MAX_CHARS + 500, BULLET_MAX_LINES_WITH_AFL);
  slide.body = stripMarkdownSymbolsForStudents(polished || merged);
}

/**
 * AFL on deck: starter →2, main →6, connections →8, plenary →9, extended →10, feedback →12.
 */
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

function clampSlideBodyToDeckRules(slides: StructuredLessonSlideModel[]): void {
  const aflHeavy = new Set([1, 5, 7, 8, 9, 11]);
  for (let i = 0; i < slides.length; i++) {
    const lim = SLIDE_BODY_LIMIT[i] ?? { chars: 2200, lines: 16 };
    const maxLines = aflHeavy.has(i) ? BULLET_MAX_LINES_WITH_AFL : BULLET_MAX_LINES;
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
  "Subject Grade Date",
  "Starter Activity",
  "Chapter Topic and SDG Goal",
  "Learning Objectives",
  "Learning Outcomes",
  "Main Phase Core Teaching",
  "Differentiated Activity Mini Plenary",
  "UAE Real Life Cross Curricular Link",
  "Plenary",
  "Extended Task",
  "Exit Ticket",
  "Success Criteria Self Evaluation",
  "Thank You Slide",
];

const SLIDE_TITLES_AR: readonly string[] = [
  "المادة والصف والتاريخ",
  "نشاط التمهيد",
  "الفصل والموضوع وهدف التنمية المستدامة",
  "الأهداف التعليمية",
  "نواتج التعلم",
  "المرحلة الأساسية للتعليم",
  "نشاط متمايز وتلخيص مصغر",
  "الإمارات أو الحياة الواقعية أو الربط بين المواد",
  "الختام",
  "مهمة موسعة",
  "بطاقة الخروج",
  "معايير النجاح والتقييم الذاتي",
  "شريحة الشكر",
];

export function buildStructuredLessonSlides(ctx: StructuredLessonPptContext): StructuredLessonSlideModel[] {
  const topic = ctx.topic.trim() || "this topic";
  const subj = ctx.subject.trim();
  const gr = ctx.grade.trim();
  const plan = (ctx.fullLessonPlan || "").trim();
  const ppt = (ctx.pptContent || "").trim();
  const lo = (ctx.learningObjectivesText || "").trim();
  const hw = (ctx.homeworkTask || "").trim();
  const anchor = `Context: ${subj}, ${gr}, topic "${topic}".`;
  const isAr = isArabicLanguageSubject(subj);
  const contextAnchor = isAr ? `السياق: مادة ${subj}، الصف ${gr}، الموضوع «${topic}».` : anchor;

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
      isAr ? `رحب بالطلاب وابدأ دون إضافة أي نص على هذه الشريحة سوى المادة والصف والتاريخ.` : `Welcome the class; keep this slide limited to subject, grade, and date only.`,
      isAr,
    ),
    includeImageSlot: false,
  });

  const s2 = pickDeck(
    "starter",
    ["starter", "hook", "warm up", "predict", "guess", "التمهيد", "استهلال"],
    isAr
      ? `تمهيد غني لموضوع «${topic}»: يشوق الطلاب ويدفعهم للتنبؤ بالموضوع دون كشف الفصل أو الأهداف. نشاط تفاعلي مفصل بخطوات زمنية واضحة ومهام يقوم بها كل طالب.`
      : `Rich starter for "${topic}": hook learners, invite predictions about what today is about, without naming the chapter or listing objectives. Interactive, detailed, timed steps; no objectives or chapter reveal on this slide.`,
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
      ? `فقط: اسم الفصل، اسم الموضوع «${topic}»، وهدف تنمية مستدامة واحد مرتبط (رقم واسم). بلا أنشطة ولا أهداف ولا شرح إضافي.`
      : `Only: chapter name, topic name "${topic}", and one SDG goal (number and title) linked to this learning. No activities, objectives, or extra explanation.`,
    "2 minutes",
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
      ? `فقط أهداف التعلم لدرس «${topic}»: 3 إلى 5 أهداف بأفعال من تصنيف بلوم (مثل تحليل، تطبيق، تقييم). لا نواتج ولا أنشطة ولا أمثلة طويلة ولا شرح إضافي.`
      : `Learning objectives only for "${topic}": 3–5 lines using Bloom action verbs (e.g. analyse, justify, design). No outcomes, activities, worked examples, or extra notes on this slide.`,
    "3 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  const s4Body = stripMarkdownSymbolsForStudents(
    mergeBodies(
      lo,
      s4Pick.body,
      isAr ? `${contextAnchor}\nأهداف فقط.` : `${contextAnchor}\nObjectives only; align to the lesson but do not paste outcomes here.`,
    ),
  );
  slides.push({ slideTitle: T[3]!, body: s4Body, speakerNotes: s4Pick.notes, includeImageSlot: false });

  const s5 = pickDeck(
    "learningOutcomes",
    ["learning outcomes", "students will", "النواتج"],
    isAr
      ? `فقط نواتج قابلة للقياس لدرس «${topic}» بعد التعلم. صاغها بصيغة أفعال قابلة للملاحظة وتتوافق مع الأهداف دون نسخ صياغتها حرفياً. لا أنشطة ولا ملخص فصل.`
      : `Learning outcomes only: measurable, observable statements of what learners will be able to do after this lesson, aligned with objectives but not copied verbatim. No activities or chapter summary.`,
    "3 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T[4]!, body: s5.body, speakerNotes: s5.notes, includeImageSlot: false });

  const s6 = pickDeck(
    "mainPhase",
    ["main phase", "main teaching", "core teaching", "المرحلة الأساسية", "شرح"],
    isAr
      ? `المرحلة الأساسية لموضوع «${topic}»: أولاً المحتوى التعليمي الكامل (مفاهيم، مصطلحات، شرح واضح، مثال معنى). بعد ذلك فقط أنشطة تطبيق (مثل I Do / We Do / You Do أو محطات تعلم) تدعم ما تم شرحه ولا تحل محله. لا اختتام ولا تمايز ولا بطاقة خروج.`
      : `Main phase core teaching for "${topic}": first deliver the full lesson content (concepts, key terms, clear explanation, concise worked meaning). Only after that, add learning activities (e.g. I Do, We Do, You Do, stations, jigsaw) that apply the taught ideas and do not replace the explanation. No plenary, differentiation, or exit ticket on this slide.`,
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
      ? `فقط: مهام متمايزة لذوي التحصيل الأعلى والأوسط والأدنى لموضوع «${topic}»، ثم فقرة واحدة كتلخيص مصغر للتحقق السريع. لا محتوى الشرح الرئيسي ولا واجب ولا نواتج.`
      : `Differentiated tasks only for higher, middle, and lower attainers on "${topic}", then one short mini plenary checkpoint. No core teaching content, homework, or outcomes on this slide.`,
    "10–12 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  slides.push({ slideTitle: T[6]!, body: s7.body, speakerNotes: s7.notes, includeImageSlot: false });

  const s8 = pickSingleContextualLink(plan, ppt, topic, subj, gr, isAr, contextAnchor, "4–6 minutes");
  slides.push({ slideTitle: T[7]!, body: s8.body, speakerNotes: s8.notes, includeImageSlot: false });

  const s9 = pickDeck(
    "plenary",
    ["plenary", "reflection", "recap", "الختام", "تلخيص"],
    isAr
      ? `فقط نشاط ختامي واحد لموضوع «${topic}» للتأمل أو التلخيص أو النقاش. يمكن العمل الجماعي. لا تعليم جديد ولا واجب ولا أهداف.`
      : `Plenary activity only for "${topic}": reflection, recap, or discussion task; group formats allowed. No new teaching, homework, or objectives on this slide.`,
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
      ? `فقط مهمة موسعة أو واجب لموضوع «${topic}»: بحث، تطبيق إبداعي، تدريب، أو مهمة تحقيقية مع معايير نجاح مختصرة. لا شرح درس كامل ولا ختام.`
      : `Extended task or homework only for "${topic}": research, creative application, practice, or investigative work with brief success criteria. No full lesson explanation or plenary on this slide.`,
    "set expectations only",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  const s10Body = stripMarkdownSymbolsForStudents(
    mergeBodies(hw, s10Pick.body, isAr ? `${contextAnchor}\nمهمة واحدة فقط.` : `${contextAnchor}\nSingle extended task only.`),
  );
  slides.push({ slideTitle: T[9]!, body: s10Body, speakerNotes: s10Pick.notes, includeImageSlot: false });

  const s11 = pickDeck(
    "exitTicket",
    ["exit ticket", "ticket to leave", "بطاقة الخروج"],
    isAr
      ? `فقط بطاقة خروج قصيرة لموضوع «${topic}» لقياس سريع. لا شرح ولا واجب موسع.`
      : `Exit ticket only for "${topic}": concise formative questions. No lesson explanation or homework text on this slide.`,
    "3–4 minutes",
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
      ? `فقط معايير النجاح والتقييم الذاتي لموضوع «${topic}» (مثل أستطيع أن، قائمة تحقق، مقياس). لا محتوى جديد ولا تكرار بطاقة الخروج.`
      : `Success criteria and self evaluation only for "${topic}": I can statements, checklist, or rating scale. No new teaching content and no exit ticket repetition.`,
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
        ? `شكراً لكم على تركيزكم ومشاركتكم البناءة في درس اليوم.\nأنتم قادرون على مواصلة التعلم بثقة.`
        : `Thank you for your focus and constructive participation in today’s lesson.\nYou are ready to keep building on what you learned.`,
    ),
    speakerNotes: buildTeacherSlideNotes(
      "1 minute",
      isAr ? `إغلاق إيجابي قصير فقط.` : `Brief positive close only; no new content on this slide.`,
      isAr,
    ),
    includeImageSlot: false,
  });

  applyAflDeckInjections(slides, ctx.aflSelections);
  clampSlideBodyToDeckRules(slides);

  if (slides.length !== STRUCTURED_LESSON_DECK_SLIDE_COUNT) {
    console.error("[ppt-structured-lesson] expected 13 slides, got", slides.length);
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

/** Maps three FLUX URLs to slides 2, 6, 9 (indices 1, 5, 8). */
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
