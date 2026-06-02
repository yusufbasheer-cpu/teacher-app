import {
  buildProgrammaticSlide1Body,
  buildTeacherObjectivesSlide4Body,
  parseDeckBodiesFromPptOutline,
  sanitizeEarlyPptSlideBody,
  sanitizeSlide10ExtendedBody,
  sanitizeSlide7DifferentiatedBody,
  stripSlideTitleEchoFromBody,
  type EarlySlideSanitizeContext,
} from "@/lib/ppt-slide-by-slide";
import { isUaeCurriculumFramework } from "@/lib/curriculum-framework";
import { AFL_PHASE_IDS, formatToolsBlockForSlide, type AflPhaseId, type AflSelectionsPayload } from "@/lib/afl-tools";
import {
  usesArabicPptSlideTitles,
  type LessonPlanResult,
  getPptSourceLessonText,
  getPptSourceSlideOutline,
} from "@/lib/lesson-plan";

/** Exactly thirteen slides; single instructional purpose per slide; no overflow slides. */
export const STRUCTURED_LESSON_DECK_SLIDE_COUNT = 13 as const;

/** Slides that reserve a right-hand image column in the 13-slide Layah deck (0-based indices). */
export const PPT_IMAGE_SLIDE_INDEX_SET = new Set<number>([0, 1, 2, 5, 6, 7, 8, 9, 10, 11]);

/** Legacy note: FLUX images previously only on slides 2, 6, 9 — superseded by full deck pipeline in `ppt-image-resolver.ts`. */
export const PPT_FLUX_PRIMARY_SLIDE_INDICES = [2, 5, 6, 10, 11] as const;

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
  differentiated: (plan: string) =>
    extractByHints(
      plan,
      [
        "differentiation",
        "differentiated",
        "support challenge",
        "sen",
        "eal",
        "differentiated activities",
        "differentiated tasks",
        "tiered tasks",
        "scaffolded",
        "extension task",
        "التمايز",
        "التنويع",
      ],
      DECK_STOP_DIFF,
    ),
  uaeOnly: (plan: string) =>
    extractByHints(
      plan,
      ["uae connection", "uae context", "uae link", "united arab emirates", "national identity", "الإمارات", "الهوية"],
      DECK_STOP_UAE,
    ),
  realLifeOnly: (plan: string) =>
    extractByHints(
      plan,
      [
        "real life",
        "real world",
        "real-life",
        "real-world",
        "authentic context",
        "everyday application",
        "real world application",
        "real-world connection",
        "beyond the classroom",
        "الحياة الواقعية",
      ],
      DECK_STOP_UAE,
    ),
  crossOnly: (plan: string) =>
    extractByHints(
      plan,
      [
        "cross curricular",
        "cross-curricular",
        "cross curricular link",
        "another subject",
        "subject links",
        "subject connections",
        "interdisciplinary",
        "related subjects",
        "الربط بين المواد",
      ],
      DECK_STOP_UAE,
    ),
  careerOnly: (plan: string) =>
    extractByHints(
      plan,
      ["career", "profession", "job role", "occupation", "careers", "vocational", "professional connection", "مهنة", "وظيفة"],
      DECK_STOP_UAE,
    ),
  globalOnly: (plan: string) =>
    extractByHints(
      plan,
      ["global", "world issue", "worldwide", "sdg", "sustainable development goal", "عالمي", "قضية عالمية"],
      DECK_STOP_UAE,
    ),
  subjectIntegrationOnly: (plan: string) =>
    extractByHints(
      plan,
      [
        "subject integration",
        "integrate with science",
        "integrate with math",
        "integrate with english",
        "ربط مع العلوم",
        "ربط مع الرياضيات",
      ],
      DECK_STOP_UAE,
    ),
  plenary: (plan: string) =>
    extractByHints(
      plan,
      [
        "plenary",
        "lesson closure",
        "reflection",
        "summary activity",
        "wrap up",
        "wrap-up",
        "closing activity",
        "consolidation",
        "round up",
        "الختام",
        "التأمل",
        "التلخيص",
      ],
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

/** Rule 1: remove lines that preview or reference later slides (EN + AR). */
const LINE_FUTURE_SLIDE_LEAK_EN =
  /\b(?:next\s+slide|following\s+slide|on\s+slide\s*\d+|slide\s*\d+|slides?\s*\d+|coming\s*(?:up|next)|later\s+in\s+this\s+lesson|after\s+(?:this|the)\s+slide|we\s+will\s+(?:then|next|move)|before\s+we\s+(?:go|move)\s+to)\b/i;
const LINE_FUTURE_SLIDE_LEAK_AR =
  /الشريحة\s*(?:التالية|القادمة)(?:\s|$)|سننتقل\s*إلى\s*الشريحة|في\s*الشريحة\s*(?:التالية|القادمة)|رقم\s*الشريحة\s*(?:التالية|القادمة)/i;

function stripFutureSlideLeakageFromBody(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (LINE_FUTURE_SLIDE_LEAK_EN.test(t)) return false;
      if (LINE_FUTURE_SLIDE_LEAK_AR.test(t)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

/** Rule 2: drop duplicate paragraph blocks and duplicate long lines within one slide. */
function dedupeRepeatedContentInSlideBody(body: string): string {
  let s = body.replace(/\r\n/g, "\n").trim();
  const blocks = s.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const seenBlock = new Set<string>();
  const outBlocks: string[] = [];
  for (const b of blocks) {
    const k = b.replace(/\s+/g, " ").trim().toLowerCase();
    if (k.length < 18) {
      outBlocks.push(b);
      continue;
    }
    if (seenBlock.has(k)) continue;
    seenBlock.add(k);
    outBlocks.push(b);
  }
  s = outBlocks.join("\n\n");
  const lines = s.split("\n");
  const seenLine = new Set<string>();
  const outLines: string[] = [];
  for (const line of lines) {
    const k = line.replace(/\s+/g, " ").trim().toLowerCase();
    if (k.length < 32) {
      outLines.push(line);
      continue;
    }
    if (seenLine.has(k)) continue;
    seenLine.add(k);
    outLines.push(line);
  }
  return outLines.join("\n").trim();
}

/** Rule 3: remove long lines identical to a line already finalized on an earlier slide. */
function stripLinesDuplicatedFromEarlierSlides(body: string, previousBodies: string[]): string {
  const earlier = new Set<string>();
  for (const pb of previousBodies) {
    for (const line of pb.replace(/\r\n/g, "\n").split("\n")) {
      const k = line.replace(/\s+/g, " ").trim().toLowerCase();
      if (k.length >= 40) earlier.add(k);
    }
  }
  return body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => {
      const k = line.replace(/\s+/g, " ").trim().toLowerCase();
      if (k.length < 40) return true;
      return !earlier.has(k);
    })
    .join("\n")
    .trim();
}

/** Lines that look like *other* slide section titles (drop if they appear on the wrong slide index). */
const MISPLACE_SECTION_HEADING_DENY: Record<number, readonly RegExp[]> = {
  1: [
    /^#*\s*learning\s+objectives?\s*:?\s*$/i,
    /^#*\s*learning\s+outcomes?\s*:?\s*$/i,
    /^#*\s*success\s+criteria\b/i,
    /^#*\s*exit\s+ticket\b/i,
    /^#*\s*plenary\b/i,
    /^#*\s*(extended\s+task|homework|home\s+learning)\b/i,
    /^#*\s*differentiated(\s+activity)?\b/i,
    /^#*\s*main\s+phase\b/i,
    /^#*\s*uae\b/i,
    /^#*\s*(cross[\s-]*curricular|real\s+life)\b/i,
    /^(الأهداف التعليمية|أهداف التعلم|النواتج|الختام|بطاقة الخروج|معايير النجاح|الواجب)\s*:?\s*$/i,
  ],
  2: [
    /^#*\s*starter(\s+activity)?\s*:?\s*$/i,
    /^#*\s*learning\s+objectives?\s*:?\s*$/i,
    /^#*\s*learning\s+outcomes?\s*:?\s*$/i,
    /^#*\s*main\s+phase\b/i,
    /^#*\s*differentiated\b/i,
    /^#*\s*plenary\b/i,
    /^#*\s*(extended\s+task|homework)\b/i,
    /^#*\s*exit\s+ticket\b/i,
    /^#*\s*success\s+criteria\b/i,
    /^(التمهيد|الأهداف|النواتج|المرحلة الأساسية|الختام|بطاقة الخروج|معايير النجاح)\s*:?\s*$/i,
  ],
  3: [
    /^#*\s*learning\s+outcomes?\s*:?\s*$/i,
    /^#*\s*success\s+criteria\b/i,
    /^#*\s*exit\s+ticket\b/i,
    /^#*\s*plenary\b/i,
    /^#*\s*(extended\s+task|homework)\b/i,
    /^#*\s*differentiated\b/i,
    /^#*\s*main\s+phase\b/i,
    /^#*\s*starter(\s+activity)?\s*:?\s*$/i,
    /^#*\s*chapter\b/i,
    /^(النواتج|الختام|بطاقة الخروج|معايير النجاح|المرحلة الأساسية|التمهيد)\s*:?\s*$/i,
  ],
  4: [
    /^#*\s*learning\s+objectives?\s*:?\s*$/i,
    /^#*\s*success\s+criteria\b/i,
    /^#*\s*exit\s+ticket\b/i,
    /^#*\s*plenary\b/i,
    /^#*\s*(extended\s+task|homework)\b/i,
    /^#*\s*differentiated\b/i,
    /^#*\s*main\s+phase\b/i,
    /^#*\s*starter(\s+activity)?\s*:?\s*$/i,
    /^(الأهداف التعليمية|الختام|بطاقة الخروج|معايير النجاح)\s*:?\s*$/i,
  ],
  5: [
    /^#*\s*plenary\b/i,
    /^#*\s*(extended\s+task|homework)\b/i,
    /^#*\s*exit\s+ticket\b/i,
    /^#*\s*success\s+criteria\b/i,
    /^#*\s*differentiated(\s+activity)?\b/i,
    /^#*\s*uae\b/i,
    /^#*\s*(cross[\s-]*curricular|real\s+life)\b/i,
    /^#*\s*learning\s+objectives?\s*:?\s*$/i,
    /^#*\s*learning\s+outcomes?\s*:?\s*$/i,
    /^#*\s*starter(\s+activity)?\s*:?\s*$/i,
    /^#*\s*chapter\b/i,
    /^(الختام|بطاقة الخروج|معايير النجاح|التمايز|الإمارات)\s*:?\s*$/i,
  ],
  6: [
    /^#*\s*uae\b/i,
    /^#*\s*(cross[\s-]*curricular|real\s+life)\b/i,
    /^#*\s*plenary\b/i,
    /^#*\s*(extended\s+task|homework)\b/i,
    /^#*\s*exit\s+ticket\b/i,
    /^#*\s*success\s+criteria\b/i,
    /^#*\s*main\s+phase\b/i,
    /^#*\s*learning\s+objectives?\s*:?\s*$/i,
    /^#*\s*learning\s+outcomes?\s*:?\s*$/i,
    /^#*\s*starter(\s+activity)?\s*:?\s*$/i,
    /^(الإمارات|الختام|بطاقة الخروج|معايير النجاح|المرحلة الأساسية)\s*:?\s*$/i,
  ],
  7: [
    /^#*\s*plenary\b/i,
    /^#*\s*(extended\s+task|homework)\b/i,
    /^#*\s*exit\s+ticket\b/i,
    /^#*\s*success\s+criteria\b/i,
    /^#*\s*differentiated(\s+activity)?\b/i,
    /^#*\s*main\s+phase\b/i,
    /^#*\s*learning\s+objectives?\s*:?\s*$/i,
    /^#*\s*learning\s+outcomes?\s*:?\s*$/i,
    /^#*\s*starter(\s+activity)?\s*:?\s*$/i,
    /^#*\s*chapter\b/i,
    /^(الختام|بطاقة الخروج|معايير النجاح|التمايز|المرحلة الأساسية)\s*:?\s*$/i,
  ],
  8: [
    /^#*\s*(extended\s+task|homework)\b/i,
    /^#*\s*exit\s+ticket\b/i,
    /^#*\s*success\s+criteria\b/i,
    /^#*\s*learning\s+objectives?\s*:?\s*$/i,
    /^#*\s*learning\s+outcomes?\s*:?\s*$/i,
    /^#*\s*main\s+phase\b/i,
    /^#*\s*differentiated\b/i,
    /^#*\s*starter(\s+activity)?\s*:?\s*$/i,
    /^#*\s*chapter\b/i,
    /^(الواجب|بطاقة الخروج|معايير النجاح|الأهداف|النواتج)\s*:?\s*$/i,
  ],
  9: [
    /^#*\s*exit\s+ticket\b/i,
    /^#*\s*success\s+criteria\b/i,
    /^#*\s*plenary\b/i,
    /^#*\s*learning\s+objectives?\s*:?\s*$/i,
    /^#*\s*learning\s+outcomes?\s*:?\s*$/i,
    /^#*\s*main\s+phase\b/i,
    /^#*\s*differentiated\b/i,
    /^#*\s*uae\b/i,
    /^#*\s*starter(\s+activity)?\s*:?\s*$/i,
    /^#*\s*chapter\b/i,
    /^(بطاقة الخروج|معايير النجاح|الختام|الأهداف|النواتج)\s*:?\s*$/i,
  ],
  10: [
    /^#*\s*success\s+criteria\b/i,
    /^#*\s*plenary\b/i,
    /^#*\s*(extended\s+task|homework)\b/i,
    /^#*\s*learning\s+objectives?\s*:?\s*$/i,
    /^#*\s*learning\s+outcomes?\s*:?\s*$/i,
    /^#*\s*main\s+phase\b/i,
    /^#*\s*differentiated\b/i,
    /^#*\s*uae\b/i,
    /^#*\s*starter(\s+activity)?\s*:?\s*$/i,
    /^#*\s*chapter\b/i,
    /^(معايير النجاح|الختام|الواجب|الأهداف|النواتج)\s*:?\s*$/i,
  ],
  11: [
    /^#*\s*exit\s+ticket\b/i,
    /^#*\s*plenary\b/i,
    /^#*\s*(extended\s+task|homework)\b/i,
    /^#*\s*learning\s+objectives?\s*:?\s*$/i,
    /^#*\s*learning\s+outcomes?\s*:?\s*$/i,
    /^#*\s*main\s+phase\b/i,
    /^#*\s*differentiated\b/i,
    /^#*\s*uae\b/i,
    /^#*\s*starter(\s+activity)?\s*:?\s*$/i,
    /^#*\s*chapter\b/i,
    /^(بطاقة الخروج|الختام|الواجب|الأهداف|النواتج)\s*:?\s*$/i,
  ],
};

function stripMisplacedSectionHeadingLines(slideIndex: number, body: string): string {
  const rules = MISPLACE_SECTION_HEADING_DENY[slideIndex];
  if (!rules?.length) return body;
  return body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (t.length > 96) return true;
      if (t.length < 4) return true;
      return !rules.some((re) => re.test(t));
    })
    .join("\n")
    .trim();
}

/**
 * Rules 1–3: strip forward references, dedupe within slide, drop lines copied from earlier slides;
 * run after AFL merge, before length clamp.
 */
function applyPptIsolationValidationToDeck(
  slides: StructuredLessonSlideModel[],
  topic = "",
): void {
  const prevBodies: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]!;
    let b = slide.body;
    b = stripSlideTitleEchoFromBody(b, slide.slideTitle);
    b = stripFutureSlideLeakageFromBody(b);
    b = dedupeRepeatedContentInSlideBody(b);
    b = stripMisplacedSectionHeadingLines(i, b);
    b = stripLinesDuplicatedFromEarlierSlides(b, prevBodies);
    if (i === 6) b = sanitizeSlide7DifferentiatedBody(b, topic);
    if (i === 9) b = sanitizeSlide10ExtendedBody(b, slide.slideTitle);
    slide.body = stripMarkdownSymbolsForStudents(b);
    prevBodies.push(slide.body);
  }
}

function usesArabicPptDeck(subject: string): boolean {
  return usesArabicPptSlideTitles(subject);
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

type NonUaeLinkKey = "cross" | "realLife" | "career" | "global" | "subjectIntegration";

/** Slide 8 when UAE Framework is selected — UAE-specific, inspection-ready connection. */
function pickUaeFrameworkSlide8(
  plan: string,
  ppt: string,
  topic: string,
  subj: string,
  gr: string,
  isAr: boolean,
  suggestedTiming: string,
): { body: string; notes: string } {
  const uaePlan = plan ? extractFromFullPlanDeck(plan, "uaeOnly") : "";
  const crossPlan = plan ? extractFromFullPlanDeck(plan, "crossOnly") : "";
  const pptUae = ppt ? extractFromPptContent(ppt, ["uae", "emirates", "khda", "spea", "moe", "الإمارات"]) : "";
  const pptCross = ppt ? extractFromPptContent(ppt, ["cross curricular", "cross-curricular", "الربط"]) : "";
  let body = stripMarkdownSymbolsForStudents(
    mergeBodies(
      mergeBodies(uaePlan, crossPlan, ""),
      mergeBodies(pptUae, pptCross, ""),
      "",
    ).trim(),
  );
  if (body.replace(/\s+/g, "").length < MIN_SINGLE_LINK_CHARS) {
    body = stripMarkdownSymbolsForStudents(
      isAr
        ? `ربط إماراتي: موضوع «${topic}» في ${subj}\n\nالهوية الوطنية: يرتبط موضوع «${topic}» بقيم الإمارات وأهدافها نحو الابتكار والمعرفة.\n\nمواءمة المنهج الإماراتي: يدعم تدريس «${topic}» أهداف وزارة التربية والتعليم ومعايير الجودة الوطنية.\n\nمعايير خدة وسبيا: التعلم الفعّال في هذا الموضوع يعكس مؤشرات التقييم والتفتيش المدرسي.\n\nأهداف التنمية المستدامة: فهم «${topic}» يسهم في تحقيق أهداف التنمية المستدامة ضمن رؤية الإمارات 2071.`
        : `UAE Real-Life Connection: "${topic}" (${subj}, ${gr})\n\nUAE National Identity: This topic connects to UAE values of knowledge, innovation, and sustainable development — central to Vision 2071.\n\nUAE MOE Curriculum Alignment: Teaching "${topic}" directly supports UAE Ministry of Education learning standards and curriculum goals.\n\nKHDA and SPEA Inspection Standards: Effective delivery of "${topic}" demonstrates the high-quality, evidence-based teaching that inspectors look for.\n\nSDG in UAE Context: Understanding "${topic}" contributes to the UAE's commitment to Sustainable Development Goals and its role as a global knowledge hub.`,
    );
  }
  const notes = buildTeacherSlideNotes(
    suggestedTiming,
    isAr
      ? "شريحة 8 — إطار الإمارات: ربط محلي، مواءمة، تفتيش، هوية، وتنمية مستدامة."
      : "Slide 8 — UAE framework: landmarks/values, MOE, KHDA/SPEA, national identity, SDG in UAE context.",
    isAr,
  );
  return { body, notes };
}

/** Slide 8 when UAE Framework is off — exactly one non-UAE link type (A–E). */
function pickNonUaeSlide8(
  plan: string,
  ppt: string,
  topic: string,
  subj: string,
  gr: string,
  isAr: boolean,
  suggestedTiming: string,
): { body: string; notes: string } {
  type Key = NonUaeLinkKey;
  const fromPlan = (k: Key) => {
    if (!plan) return "";
    if (k === "realLife") return extractFromFullPlanDeck(plan, "realLifeOnly");
    if (k === "cross") return extractFromFullPlanDeck(plan, "crossOnly");
    if (k === "career") return extractFromFullPlanDeck(plan, "careerOnly");
    if (k === "global") return extractFromFullPlanDeck(plan, "globalOnly");
    return extractFromFullPlanDeck(plan, "subjectIntegrationOnly");
  };
  const fromPptBlocks: Record<Key, string> = {
    cross: ppt ? extractFromPptContent(ppt, ["cross curricular", "cross-curricular", "الربط"]) : "",
    realLife: ppt ? extractFromPptContent(ppt, ["real life", "real world", "الحياة"]) : "",
    career: ppt ? extractFromPptContent(ppt, ["career", "profession", "مهنة"]) : "",
    global: ppt ? extractFromPptContent(ppt, ["global", "world", "sdg", "عالمي"]) : "",
    subjectIntegration: ppt
      ? extractFromPptContent(ppt, ["integrate with", "subject integration", "science", "math", "english"])
      : "",
  };
  const merged = (k: Key) =>
    stripMarkdownSymbolsForStudents(mergeBodies(fromPlan(k), fromPptBlocks[k], "").trim());

  const scored: { key: Key; text: string; len: number }[] = (
    ["cross", "realLife", "career", "global", "subjectIntegration"] as const
  ).map((key) => {
    const text = merged(key);
    return { key, text, len: text.replace(/\s+/g, "").length };
  });
  scored.sort((a, b) => b.len - a.len);
  const best = scored.find((s) => s.len >= MIN_SINGLE_LINK_CHARS) ?? scored[0]!;
  let body = best.text;
  if (body.replace(/\s+/g, "").length < MIN_SINGLE_LINK_CHARS) {
    body = stripMarkdownSymbolsForStudents(
      isAr
        ? `ربط الحياة الواقعية والمواد الأخرى: موضوع «${topic}»\n\nتطبيق واقعي: تظهر مفاهيم «${topic}» في الحياة اليومية وفي حلّ المشكلات الفعلية.\n\nربط بمادة أخرى: يرتبط موضوع «${topic}» بمواد أخرى كالعلوم والرياضيات واللغة — مما يعمّق الفهم.\n\nالمسارات المهنية: يوظّف المتخصصون في مجالات العلوم والتكنولوجيا والهندسة والرياضيات والتعليم معرفة «${topic}» في عملهم اليومي.`
        : `Real-Life and Cross-Curricular Connection: "${topic}" (${subj}, ${gr})\n\nReal-Life Application: The concepts in "${topic}" appear in everyday problem-solving, communication, and decision-making that students will encounter beyond the classroom.\n\nCross-Curricular Link: "${topic}" connects to other subjects — students can apply this knowledge across Science, Mathematics, and Language Arts, strengthening understanding in multiple areas.\n\nCareer Connection: Professionals in STEM, education, healthcare, and creative industries use understanding of "${topic}" as a core part of their daily work.`,
    );
  }
  const label: Record<Key, string> = {
    cross: isAr ? "ربط بين المواد" : "cross-curricular",
    realLife: isAr ? "حياة واقعية" : "real-life application",
    career: isAr ? "مهنة" : "career connection",
    global: isAr ? "قضية عالمية/هدف تنمية" : "global/SDG link",
    subjectIntegration: isAr ? "دمج مواد" : "subject integration",
  };
  const notes = buildTeacherSlideNotes(
    suggestedTiming,
    isAr
      ? `شريحة 8 — ربط واحد فقط (${label[best.key]}).`
      : `Slide 8 — one link only (${label[best.key]}). No UAE content.`,
    isAr,
  );
  return { body, notes };
}

function pickSlide8Connection(
  uaeFrameworkSelected: boolean,
  plan: string,
  ppt: string,
  topic: string,
  subj: string,
  gr: string,
  isAr: boolean,
  suggestedTiming: string,
): { body: string; notes: string } {
  if (uaeFrameworkSelected) {
    return pickUaeFrameworkSlide8(plan, ppt, topic, subj, gr, isAr, suggestedTiming);
  }
  return pickNonUaeSlide8(plan, ppt, topic, subj, gr, isAr, suggestedTiming);
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
 * AFL on deck: starter →2, main →6, differentiation →7, plenary →9, exitTicket →11, successCriteria →12.
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
  go(6, "differentiation", afl.differentiation);
  go(8, "plenary", afl.plenary);
  go(10, "exitTicket", afl.exitTicket);
  go(11, "successCriteria", afl.successCriteria);
}

function clampSlideBodyToDeckRules(slides: StructuredLessonSlideModel[]): void {
  const aflHeavy = new Set([1, 5, 6, 7, 8, 9, 10, 11]);
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
  chapter?: string;
  teacherName: string;
  learningObjectivesText?: string;
  fullLessonPlan?: string;
  pptContent?: string;
  homeworkTask?: string;
  aflSelections?: AflSelectionsPayload;
  /** Curriculum framework id; drives slide 8 UAE vs global connection mode. */
  curriculumFramework?: string;
};

export const SLIDE_8_TITLE_UAE_EN = "UAE Real Life and Cross Curricular Connection" as const;
export const SLIDE_8_TITLE_GLOBAL_EN = "Real Life and Cross Curricular Connection" as const;
export const SLIDE_8_TITLE_UAE_AR = "الإمارات والحياة الواقعية والربط بين المواد" as const;
export const SLIDE_8_TITLE_GLOBAL_AR = "الحياة الواقعية والربط بين المواد" as const;

/** Fixed English slide titles (deck order). Slide 8 title is set via {@link getStructuredLessonSlideTitle}. */
export const STRUCTURED_LESSON_SLIDE_TITLES_EN: readonly string[] = [
  "Subject, Grade, Date",
  "Starter Activity",
  "Chapter, Topic and SDG Goal",
  "Learning Objectives",
  "Learning Outcomes",
  "Main Phase Core Teaching",
  "Differentiated Activity and Mini Plenary",
  SLIDE_8_TITLE_GLOBAL_EN,
  "Plenary",
  "Extended Task",
  "Exit Ticket",
  "Success Criteria and Self Evaluation",
  "Thank You",
];

/** Arabic slide titles (same order as English). Slide 8 uses {@link getStructuredLessonSlideTitle}. */
export const STRUCTURED_LESSON_SLIDE_TITLES_AR: readonly string[] = [
  "المادة والصف والتاريخ",
  "نشاط التمهيد",
  "الفصل والموضوع وهدف التنمية المستدامة",
  "الأهداف التعليمية",
  "نواتج التعلم",
  "المرحلة الأساسية للتعليم",
  "نشاط متمايز وتلخيص مصغر",
  SLIDE_8_TITLE_GLOBAL_AR,
  "الختام",
  "مهمة موسعة",
  "بطاقة الخروج",
  "معايير النجاح والتقييم الذاتي",
  "شكراً لكم",
];

/** Legacy slide 8 titles still accepted when parsing older PPT outlines. */
export const SLIDE_8_TITLE_LEGACY_EN: readonly string[] = [
  "UAE Real Life Cross Curricular Link",
  SLIDE_8_TITLE_UAE_EN,
  SLIDE_8_TITLE_GLOBAL_EN,
];

export function getStructuredLessonSlideTitle(
  slideIndex0Based: number,
  isAr: boolean,
  uaeFrameworkSelected: boolean,
): string {
  if (slideIndex0Based === 7) {
    if (isAr) return uaeFrameworkSelected ? SLIDE_8_TITLE_UAE_AR : SLIDE_8_TITLE_GLOBAL_AR;
    return uaeFrameworkSelected ? SLIDE_8_TITLE_UAE_EN : SLIDE_8_TITLE_GLOBAL_EN;
  }
  const titles = isAr ? STRUCTURED_LESSON_SLIDE_TITLES_AR : STRUCTURED_LESSON_SLIDE_TITLES_EN;
  return titles[slideIndex0Based] ?? `Slide ${slideIndex0Based + 1}`;
}

export function getStructuredLessonSlideTitles(
  isAr: boolean,
  uaeFrameworkSelected: boolean,
): readonly string[] {
  return Array.from({ length: STRUCTURED_LESSON_DECK_SLIDE_COUNT }, (_, i) =>
    getStructuredLessonSlideTitle(i, isAr, uaeFrameworkSelected),
  );
}

export function buildStructuredLessonSlides(ctx: StructuredLessonPptContext): StructuredLessonSlideModel[] {
  const topic = ctx.topic.trim() || "this topic";
  const subj = ctx.subject.trim();
  const gr = ctx.grade.trim();
  const plan = (ctx.fullLessonPlan || "").trim();
  const ppt = (ctx.pptContent || "").trim();
  const lo = (ctx.learningObjectivesText || "").trim();
  const hw = (ctx.homeworkTask || "").trim();
  const anchor = `Context: ${subj}, ${gr}, topic "${topic}".`;
  const isAr = usesArabicPptDeck(subj);
  const contextAnchor = isAr ? `السياق: مادة ${subj}، الصف ${gr}، الموضوع «${topic}».` : anchor;

  const locale = isAr ? "ar-AE" : "en-GB";
  const dateStr = new Date().toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const uaeFrameworkSelected = isUaeCurriculumFramework(ctx.curriculumFramework ?? "");
  const T = getStructuredLessonSlideTitles(isAr, uaeFrameworkSelected);
  const slides: StructuredLessonSlideModel[] = [];
  const parsedDeckBodies =
    ppt.length >= 40 ? parseDeckBodiesFromPptOutline(ppt, isAr, uaeFrameworkSelected) : null;
  const earlyCtx: EarlySlideSanitizeContext = {
    subject: subj,
    grade: gr,
    topic,
    chapter: ctx.chapter?.trim(),
    dateStr,
    teacherObjectives: lo,
    isAr,
  };

  const finalizeEarlySlideBody = (
    slideNumber1Based: 2 | 3 | 4 | 5,
    pick: { body: string; notes: string },
    loFallback?: string,
  ): { body: string; notes: string } => {
    if (slideNumber1Based === 4) {
      const raw = loFallback?.trim() || earlyCtx.teacherObjectives?.trim() || "";
      return {
        body: stripMarkdownSymbolsForStudents(buildTeacherObjectivesSlide4Body(raw)),
        notes: pick.notes,
      };
    }
    const fromOutline = parsedDeckBodies?.[slideNumber1Based - 1]?.trim() ?? "";
    const raw = fromOutline || pick.body.trim();
    return {
      body: stripMarkdownSymbolsForStudents(sanitizeEarlyPptSlideBody(slideNumber1Based, raw, earlyCtx)),
      notes: pick.notes,
    };
  };

  slides.push({
    slideTitle: isAr ? T[0]! : `${subj}, ${gr}`,
    body: stripMarkdownSymbolsForStudents(buildProgrammaticSlide1Body(gr, dateStr)),
    speakerNotes: buildTeacherSlideNotes(
      "1 minute",
      isAr ? `رحب بالطلاب وابدأ دون إضافة أي نص على هذه الشريحة سوى المادة والصف والتاريخ.` : `Welcome the class; keep this slide limited to subject, grade, and date only.`,
      isAr,
    ),
    includeImageSlot: true,
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
  const s2Final = finalizeEarlySlideBody(2, s2);
  slides.push({ slideTitle: T[1]!, body: s2Final.body, speakerNotes: s2Final.notes, includeImageSlot: true });

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
  const s3Final = finalizeEarlySlideBody(3, s3);
  slides.push({ slideTitle: T[2]!, body: s3Final.body, speakerNotes: s3Final.notes, includeImageSlot: true });

  const s4Final = finalizeEarlySlideBody(
    4,
    {
      body: "",
      notes: buildTeacherSlideNotes(
        "3 minutes",
        isAr
          ? "اعرض أهداف المعلم كما أدخلها في النموذج حرفياً دون تعديل."
          : "Display the teacher's form objectives verbatim — no AI edits or additions.",
        isAr,
      ),
    },
    lo,
  );
  slides.push({ slideTitle: T[3]!, body: s4Final.body, speakerNotes: s4Final.notes, includeImageSlot: false });

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
  const s5Final = finalizeEarlySlideBody(5, s5);
  slides.push({ slideTitle: T[4]!, body: s5Final.body, speakerNotes: s5Final.notes, includeImageSlot: false });

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
      ? `مهام متمايزة لموضوع «${topic}»: (1) ذوو التحصيل الأعلى — تحدٍّ يمتد إلى ما وراء الهدف، (2) ذوو التحصيل الأوسط — نشاط قياسي يحقق الهدف، (3) ذوو التحصيل الأدنى — نشاط مدعوم بالتسقيل والإرشاد. ثم في الأسفل: تلخيص مصغر — سؤال سريع للتحقق من الفهم.`
      : `Differentiated tasks for "${topic}": (1) Higher Achievers — a challenging task extending beyond the objective, (2) Middle Achievers — a standard task matching the objective, (3) Lower Achievers — a scaffolded task with sentence starters or guided prompts. At the bottom: Mini Plenary — one quick question to check understanding.`,
    "10–12 minutes",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  const s7Body = sanitizeSlide7DifferentiatedBody(s7.body, topic);
  slides.push({ slideTitle: T[6]!, body: s7Body, speakerNotes: s7.notes, includeImageSlot: true });

  const s8 = pickSlide8Connection(uaeFrameworkSelected, plan, ppt, topic, subj, gr, isAr, "4–6 minutes");
  slides.push({ slideTitle: T[7]!, body: s8.body, speakerNotes: s8.notes, includeImageSlot: true });

  const s9 = pickDeck(
    "plenary",
    ["plenary", "reflection", "recap", "الختام", "تلخيص"],
    isAr
      ? `نشاط الختام: فكّر، شارك، ناقش — موضوع «${topic}»\n\nالنشاط: يراجع الطلاب تعلّمهم ويوحّدون فهمهم لموضوع «${topic}».\n\n1. فكّر (دقيقتان): اكتب النقاط الثلاث الأهم التي تعلمتها عن «${topic}» اليوم.\n2. شارك (دقيقتان): ناقش مع زميلك — ما أبرز ما تعلمته؟ ماذا أضاف كلٌّ منكما للآخر؟\n3. تبادل الأفكار (دقيقتان): يشارك 2-3 طلاب أهم ما تعلموه مع الصف بأكمله.\n\nالربط بأهداف الدرس: يُظهر الطلاب فهمهم لـ«${topic}» ويصوغون أفكارهم الرئيسية بكلماتهم الخاصة.`
      : `Plenary: Think-Pair-Share — "${topic}"\n\nActivity: Students review and consolidate their learning about "${topic}".\n\n1. Think (2 min): Individually write down the 3 most important things you learned about "${topic}" today.\n2. Pair (2 min): Compare your key points with a partner. What did you both include? What was different?\n3. Share (2 min): 2-3 pairs share their most important insight with the class.\n\nConnection to learning objectives: Students articulate their understanding of "${topic}" in their own words, demonstrating they have met today's lesson objectives.`,
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
      : `Extended task or homework only for "${topic}": research, creative application, practice, or investigative work. Do not repeat the slide title. No success criteria, self-evaluation, exit ticket, or plenary.`,
    "set expectations only",
    isAr,
    plan,
    ppt,
    contextAnchor,
  );
  const s10Merged = mergeBodies(
    hw,
    s10Pick.body,
    isAr ? `${contextAnchor}\nمهمة واحدة فقط.` : `${contextAnchor}\nSingle extended task only.`,
  );
  const s10Body = stripMarkdownSymbolsForStudents(
    sanitizeSlide10ExtendedBody(s10Merged, T[9]!),
  );
  slides.push({ slideTitle: T[9]!, body: s10Body, speakerNotes: s10Pick.notes, includeImageSlot: true });

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
  slides.push({ slideTitle: T[10]!, body: s11.body, speakerNotes: s11.notes, includeImageSlot: true });

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
  slides.push({ slideTitle: T[11]!, body: s12.body, speakerNotes: s12.notes, includeImageSlot: true });

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
  applyPptIsolationValidationToDeck(slides, topic);
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
    curriculumFramework?: string;
  },
): StructuredLessonPptContext {
  const fullLessonText = getPptSourceLessonText(plan);
  const pptOutlineText = getPptSourceSlideOutline(plan);

  return {
    subject: meta.subject,
    grade: meta.grade,
    topic: meta.topic,
    teacherName: meta.teacherName,
    learningObjectivesText: meta.learningObjectives?.trim() || undefined,
    fullLessonPlan: fullLessonText || undefined,
    pptContent: pptOutlineText || undefined,
    homeworkTask: typeof plan["Homework Task"] === "string" ? plan["Homework Task"] : undefined,
    ...(meta.curriculumFramework?.trim()
      ? { curriculumFramework: meta.curriculumFramework.trim() }
      : plan.curriculum_framework?.trim()
        ? { curriculumFramework: plan.curriculum_framework.trim() }
        : {}),
    ...(aflPayloadHasTools(meta.aflSelections) ? { aflSelections: meta.aflSelections } : {}),
  };
}
