import type { AflPhaseId, AflSelectionsPayload } from "@/lib/afl-tools";
import { AFL_PHASE_IDS, distributeIds, formatToolsBlockForSlide } from "@/lib/afl-tools";
import type { LessonPlanResult } from "@/lib/lesson-plan";

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
const SECTION_MAX_CHARS = 3200;

function truncateBody(s: string, maxLines: number): string {
  const lines = s.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length <= maxLines) return lines.join("\n").trim();
  return lines.slice(0, maxLines).join("\n").trim();
}

function polishBody(raw: string, maxChars: number): string {
  const t = raw.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!t) return "";
  const cap = t.length > maxChars ? `${t.slice(0, maxChars).trim()}…` : t;
  return truncateBody(cap, BULLET_MAX_LINES);
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
];
const STOP_STARTER = ["prior knowledge", "main teaching", "entry ticket", "diagnostic", "mini plenary"];
const STOP_PRIOR = ["main teaching", "teaching phase", "guided practice"];
const STOP_MAIN = ["guided practice", "group activity", "ccl", "differentiation"];
const STOP_GUIDED = ["group activity", "ccl", "collaborative", "differentiation"];
const STOP_GROUP = ["differentiation", "afl", "assessment for learning", "mini plenary"];
const STOP_DIFF = ["afl", "assessment for learning", "mini plenary", "exit ticket"];
const STOP_AFL = ["mini plenary", "exit ticket", "homework", "plenary"];
const STOP_MINI = ["exit ticket", "homework", "extended task", "plenary"];
const STOP_EXIT = ["homework", "extended task", "plenary", "reflection"];
const STOP_HOME = ["plenary", "reflection", "summary"];
const STOP_PLENARY: string[] = [];

const extractors = {
  objectives: (plan: string) =>
    extractByHints(plan, ["learning objectives", "learning objective"], STOP_OBJECTIVES) ||
    extractByHints(plan, ["success criteria"], STOP_STARTER),
  starter: (plan: string) => extractByHints(plan, ["starter activity", "starter", "hook"], STOP_STARTER),
  prior: (plan: string) =>
    extractByHints(plan, ["prior knowledge", "entry ticket", "diagnostic"], STOP_PRIOR),
  main: (plan: string) =>
    extractByHints(plan, ["main teaching", "main phase", "teaching phase"], STOP_MAIN),
  guided: (plan: string) =>
    extractByHints(plan, ["guided practice", "guided instruction", "we do"], STOP_GUIDED),
  group: (plan: string) =>
    extractByHints(
      plan,
      ["classroom collaborative learning", "collaborative learning", "ccl", "group activity", "group task"],
      STOP_GROUP,
    ),
  diff: (plan: string) =>
    extractByHints(plan, ["differentiation", "support for", "challenge task", "sen"], STOP_DIFF),
  afl: (plan: string) =>
    extractByHints(plan, ["assessment for learning", "afl", "questioning strategies"], STOP_AFL),
  mini: (plan: string) =>
    extractByHints(plan, ["mini plenary", "quick check", "understanding check"], STOP_MINI),
  exit: (plan: string) => extractByHints(plan, ["exit ticket", "closure"], STOP_EXIT),
  homework: (plan: string) =>
    extractByHints(plan, ["homework", "extended task", "take-home"], STOP_HOME),
  plenary: (plan: string) =>
    extractByHints(plan, ["plenary", "reflection", "summary activity", "self-assessment"], STOP_PLENARY),
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

function buildNotes(topic: string, phase: string, aflCallout?: string): string {
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
  slide.body = polishBody(`${slide.body.trim()}${block}`, SECTION_MAX_CHARS);
}

/** Map selected tools onto the structured 13-slide deck (see `buildStructuredLessonSlides` order). */
function applyAflToolInjections(slides: StructuredLessonSlideModel[], afl: AflSelectionsPayload | undefined) {
  if (!aflPayloadHasTools(afl) || !afl) return;

  const append = (slideIndex: number, phase: AflPhaseId, ids?: string[]) => {
    const slide = slides[slideIndex];
    if (!slide || !ids?.length) return;
    appendAflToSlideBody(slide, phase, ids);
  };

  append(2, "starter", afl.starter);
  append(3, "connections", afl.connections);

  const mainIds = afl.main ?? [];
  if (mainIds.length > 0) {
    const parts = distributeIds(mainIds, 5);
    const mainSlideIndices = [4, 5, 6, 7, 9];
    parts.forEach((chunk, i) => append(mainSlideIndices[i]!, "main", chunk));
  }

  append(8, "feedback", afl.feedback);
  append(11, "extended", afl.extended);
  append(12, "plenary", afl.plenary);
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
  const topic = ctx.topic.trim() || "this topic";
  const subj = ctx.subject.trim();
  const gr = ctx.grade.trim();
  const teacher = (ctx.teacherName || "Teacher").trim() || "Teacher";
  const plan = (ctx.fullLessonPlan || "").trim();
  const ppt = (ctx.pptContent || "").trim();
  const lo = (ctx.learningObjectivesText || "").trim();
  const hw = (ctx.homeworkTask || "").trim();
  const anchor = `Context: ${subj}, ${gr}, topic "${topic}". Ground every bullet in this lesson context.`;

  const pick = (
    kind: keyof typeof extractors,
    pptHints: string[],
    topicFallback: string,
    afl?: string,
  ) => {
    const fromPlan = plan ? extractFromFullPlan(plan, kind) : "";
    const fromPpt = ppt ? extractFromPptContent(ppt, pptHints) : "";
    const body = mergeBodies(fromPlan, fromPpt, `${anchor}\n${topicFallback}`);
    return { body, notes: buildNotes(topic, fromPlan || fromPpt, afl), afl };
  };

  const slides: StructuredLessonSlideModel[] = [];

  // 0 Title — body lists meta; image optional
  slides.push({
    slideTitle: "Lesson Title",
    body: [
      `Subject: ${subj}`,
      `Grade: ${gr}`,
      `Topic: ${topic}`,
      `Teacher: ${teacher}`,
    ].join("\n"),
    speakerNotes: `Welcome learners to ${topic} in ${subj}.\n\nAFL: quick prior scan — show of hands or one-minute mind-map on "${topic}" before objectives.\n\n${AFL_GENERAL}`,
    aflCallout: "Prior scan: thumbs up/down if you have heard of this topic before.",
    includeImageSlot: true,
  });

  // 1 Learning objectives
  const objPick = pick(
    "objectives",
    ["learning objectives", "objectives"],
    `State SMART objectives for ${topic}.`,
    "Mini whiteboard: one keyword per objective.",
  );
  const objBody = mergeBodies(
    lo,
    objPick.body,
    `${anchor}\nList 3–5 measurable objectives for ${topic} in ${subj} (${gr}).`,
  );
  slides.push({
    slideTitle: "Learning Objectives",
    body: objBody,
    speakerNotes: objPick.notes,
    aflCallout: "Mini whiteboard: students write one success indicator.",
    includeImageSlot: false,
  });

  const sStarter = pick("starter", ["starter", "hook", "engage"], `Starter hook for ${topic}: puzzling question or short stimulus.`, "Think-pair-share");
  slides.push({
    slideTitle: "Starter Activity",
    body: sStarter.body,
    speakerNotes: sStarter.notes,
    aflCallout: "Think–pair–share after the hook.",
    includeImageSlot: false,
  });

  const sPrior = pick("prior", ["prior", "entry", "diagnostic"], `Prior-knowledge questions about ${topic}.`, "Cold calling");
  slides.push({
    slideTitle: "Entry Ticket — Prior Knowledge",
    body: sPrior.body,
    speakerNotes: sPrior.notes,
    aflCallout: "Cold calling with wait time after each question.",
    includeImageSlot: false,
  });

  const sMain = pick("main", ["main teaching", "explanation", "i do"], `Step-by-step teaching sequence for ${topic}.`, "Cold calling + checks");
  slides.push({
    slideTitle: "Main Teaching Phase",
    body: sMain.body,
    speakerNotes: sMain.notes,
    aflCallout: "Use hinge questions every 3–5 minutes.",
    includeImageSlot: true,
  });

  const sGuided = pick("guided", ["guided", "we do"], `Guided practice for ${topic} — work a sample together.`, "Peer assessment");
  slides.push({
    slideTitle: "Guided Practice",
    body: sGuided.body,
    speakerNotes: sGuided.notes,
    aflCallout: "Peer check of first solution step.",
    includeImageSlot: false,
  });

  const sGroup = pick(
    "group",
    ["group", "collaborative", "ccl"],
    `Collaborative task on ${topic} with clear roles and a product.`,
    "Think-pair-share",
  );
  slides.push({
    slideTitle: "Group Activity",
    body: sGroup.body,
    speakerNotes: sGroup.notes,
    aflCallout: "Gallery walk or reporter from each group.",
    includeImageSlot: true,
  });

  const sDiff = pick("diff", ["differentiation", "support", "challenge"], `Support and stretch paths for ${topic}.`, "Thumbs up/down");
  slides.push({
    slideTitle: "Differentiation",
    body: sDiff.body,
    speakerNotes: sDiff.notes,
    aflCallout: "Thumbs up/down on confidence before independent work.",
    includeImageSlot: false,
  });

  const sAfl = pick("afl", ["afl", "formative", "questioning"], `Formative moves for this lesson on ${topic}.`, "Mixed AFL");
  slides.push({
    slideTitle: "AFL Tools in This Lesson",
    body: sAfl.body,
    speakerNotes: sAfl.notes,
    aflCallout: "Rotate: cold call, TPS, whiteboards.",
    includeImageSlot: false,
  });

  const sMini = pick("mini", ["mini plenary", "check"], `Quick understanding check on ${topic}.`, "Exit-style oral");
  slides.push({
    slideTitle: "Mini Plenary",
    body: sMini.body,
    speakerNotes: sMini.notes,
    aflCallout: "One hinge question to whole class.",
    includeImageSlot: false,
  });

  const sExit = pick("exit", ["exit ticket", "closure"], `Exit questions aligned to ${topic} objectives.`, "Exit ticket");
  slides.push({
    slideTitle: "Exit Ticket",
    body: sExit.body,
    speakerNotes: sExit.notes,
    aflCallout: "Written exit ticket (2 questions max).",
    includeImageSlot: false,
  });

  const hwBody = mergeBodies(
    hw,
    pick("homework", ["homework", "assignment"], `Homework extension for ${topic}.`).body,
    `${anchor}\nExtended practice or research on ${topic}.`,
  );
  slides.push({
    slideTitle: "Homework",
    body: hwBody,
    speakerNotes: buildNotes(topic, hw || ppt, "Success criteria visible on board / LMS."),
    aflCallout: "Peer review of criteria before leaving.",
    includeImageSlot: false,
  });

  const sPlen = pick("plenary", ["plenary", "reflection", "summary"], `Summary and reflection for ${topic}.`, "Self-assessment");
  slides.push({
    slideTitle: "Plenary & Reflection",
    body: sPlen.body,
    speakerNotes: sPlen.notes,
    aflCallout: "Students rate confidence 1–4 on today's objectives.",
    includeImageSlot: true,
  });

  applyAflToolInjections(slides, ctx.aflSelections);

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
  return {
    subject: meta.subject,
    grade: meta.grade,
    topic: meta.topic,
    teacherName: meta.teacherName,
    learningObjectivesText:
      meta.learningObjectives?.trim() ||
      (typeof plan["Full Lesson Plan"] === "string"
        ? extractByHints(plan["Full Lesson Plan"], ["learning objectives", "learning objective"], STOP_OBJECTIVES)
        : undefined),
    fullLessonPlan: typeof plan["Full Lesson Plan"] === "string" ? plan["Full Lesson Plan"] : undefined,
    pptContent: typeof plan["PPT Slide Content"] === "string" ? plan["PPT Slide Content"] : undefined,
    homeworkTask: typeof plan["Homework Task"] === "string" ? plan["Homework Task"] : undefined,
    ...(aflPayloadHasTools(meta.aflSelections) ? { aflSelections: meta.aflSelections } : {}),
  };
}
