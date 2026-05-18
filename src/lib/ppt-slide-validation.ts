import {
  STRUCTURED_LESSON_DECK_SLIDE_COUNT,
  getStructuredLessonSlideTitle,
} from "@/lib/ppt-structured-lesson";
import { isUaeCurriculumFramework } from "@/lib/curriculum-framework";
import type { EarlySlideSanitizeContext } from "@/lib/ppt-slide-by-slide";
import {
  buildProgrammaticSlide1Body,
  buildTeacherObjectivesSlide4Body,
  sanitizeEarlyPptSlideBody,
  sanitizeSlide5OutcomesBody,
  sanitizeSlide7DifferentiatedBody,
  slide5OutcomesValidationMessage,
  validateSlide7DifferentiatedBody,
} from "@/lib/ppt-slide-by-slide";

export type PptSlideValidationContext = {
  slideNumber1Based: number;
  isAr: boolean;
  uaeFrameworkSelected: boolean;
  subject: string;
  topic: string;
  teacherObjectives?: string;
};

const UAE_FORBIDDEN_WHEN_OFF =
  /\b(uae|u\.a\.e\.|united arab emirates|emirates|dubai|abu dhabi|sharjah|ajman|ras al khaimah|fujairah|umm al quwain|khda|spea|moe uae|uae moe|national identity|الإمارات|دبي|أبوظبي|هوية وطنية|خدة|سپيا|وزارة التربية)\b/i;

const UAE_EXPECTED_WHEN_ON =
  /\b(uae|emirates|dubai|moe|khda|spea|national identity|الإمارات|هوية|خدة)\b/i;

/** Lines that must not appear on the wrong slide (content leakage). */
const CROSS_SLIDE_DENY: Partial<Record<number, readonly RegExp[]>> = {
  2: [
    /\blearning\s+objectives?\b/i,
    /\blearning\s+outcomes?\b/i,
    /\bsuccess\s+criteria\b/i,
    /\bexit\s+ticket\b/i,
    /\bextended\s+task\b/i,
    /\bhomework\b/i,
    /\bmain\s+phase\b/i,
    /\bplenary\b/i,
    /\bdifferentiated\b/i,
    /\bsdgs?\b|\bsustainable\s+development\s+goal/i,
    /الأهداف|النواتج|معايير النجاح|بطاقة الخروج|الختام|المرحلة الأساسية/,
  ],
  3: [
    /\blearning\s+objectives?\b/i,
    /\blearning\s+outcomes?\b/i,
    /\bstarter(\s+activity)?\b/i,
    /\bexit\s+ticket\b/i,
    /\bplenary\b/i,
    /\bmain\s+phase\b/i,
    /الأهداف|النواتج|التمهيد/,
  ],
  6: [/\bexit\s+ticket\b/i, /\bplenary\b/i, /\bdifferentiated\b/i, /\buae\b/i, /بطاقة الخروج|الختام|التمايز|الإمارات/],
  7: [
    /\bexit\s+ticket\b/i,
    /\b(?<!mini\s)plenary\b/i,
    /\bmain\s+phase\b/i,
    /\bhomework\b/i,
    /بطاقة الخروج|المرحلة الأساسية/,
  ],
  8: [
    /\blearning\s+objectives?\b/i,
    /\blearning\s+outcomes?\b/i,
    /\bstarter(\s+activity)?\b/i,
    /\bexit\s+ticket\b/i,
    /\bplenary\b/i,
    /\bmain\s+phase\b/i,
    /\bdifferentiated\b/i,
    /الأهداف|النواتج|التمهيد|بطاقة الخروج|الختام/,
  ],
  9: [/\bexit\s+ticket\b/i, /\bsuccess\s+criteria\b/i, /\bhomework\b/i, /\bextended\s+task\b/i, /بطاقة الخروج|معايير النجاح/],
  10: [/\bexit\s+ticket\b/i, /\bsuccess\s+criteria\b/i, /\bplenary\b/i, /بطاقة الخروج|معايير النجاح|الختام/],
  11: [/\bsuccess\s+criteria\b/i, /\bplenary\b/i, /\bhomework\b/i, /معايير النجاح|الختام/],
  12: [/\bexit\s+ticket\b/i, /\bplenary\b/i, /\bhomework\b/i, /بطاقة الخروج|الختام/],
};

export function buildSlide8PptModeBlock(uaeFrameworkSelected: boolean): string {
  if (uaeFrameworkSelected) {
    return `### Slide 8 mode (locked before generation)
**UAE Framework is ON.** Generate slide 8 only as:
- **Title (for deck assembly):** UAE Real Life and Cross Curricular Connection
- **Body must include (concise, inspection-ready):** a specific UAE landmark or national value link to the topic; UAE MOE curriculum alignment; KHDA and SPEA inspection-quality connection; UAE National Identity link; SDG connection in UAE context.
- Do **not** use the shorter non-UAE title. All content must be UAE-specific.`;
  }
  return `### Slide 8 mode (locked before generation)
**UAE Framework is OFF.** Generate slide 8 only as:
- **Title (for deck assembly):** Real Life and Cross Curricular Connection
- Choose **exactly ONE** of these (whichever fits the topic best): (A) cross-curricular link to another subject, (B) real-life daily application, (C) career connection, (D) global issue or SDG link, (E) integration with Science/Math/English or another subject.
- **Forbidden:** any mention of UAE, Emirates, Dubai, MOE UAE, KHDA, SPEA, or UAE National Identity.`;
}

export function buildPptSlidePreflightChecklist(ctx: PptSlideValidationContext): string {
  const title = getStructuredLessonSlideTitle(ctx.slideNumber1Based - 1, ctx.isAr, ctx.uaeFrameworkSelected);
  const only: Record<number, string> = {
    1: "grade and date lines only (subject is in the slide title, not the body)",
    2: "starter activity / AFL hook only",
    3: "chapter name, topic name, and one SDG (number + title) only",
    4: "teacher learning objectives verbatim only",
    5: "exactly one measurable learning outcome per teacher objective, same order, same count",
    6: "core teaching content first, then main-phase AFL activities only",
    7: "differentiated tasks for higher, middle, and lower achievers only, plus one optional Quick Check line (1 sentence) at the end — no Mini Plenary heading or section",
    8: ctx.uaeFrameworkSelected
      ? "UAE real life + cross-curricular + inspection-ready UAE links only"
      : "one real-life / cross-curricular / career / global / subject-integration link only — no UAE",
    9: "plenary activity only",
    10: "extended task or homework only",
    11: "exit ticket only",
    12: "success criteria and self-evaluation only",
    13: "thank-you closing line only",
  };
  const mustNot: Record<number, string> = {
    2: "objectives, outcomes, chapter block, plenary, homework, UAE link",
    3: "starter, objectives, outcomes, teaching sequence",
    6: "plenary, differentiation, exit ticket, UAE link",
    5: "extra outcomes, missing outcomes, or copying objectives verbatim",
    7: "core re-teach, homework, UAE link, Mini Plenary heading, or multi-line plenary activity",
    8: ctx.uaeFrameworkSelected ? "non-UAE generic-only content without UAE alignment" : "any UAE-specific references",
    11: "success criteria, extended homework essay",
    12: "exit ticket repeat, new teaching",
  };
  const onlyLine = only[ctx.slideNumber1Based] ?? "this slide's single purpose only";
  const notLine = mustNot[ctx.slideNumber1Based];
  return `### Pre-generation validation (slide ${ctx.slideNumber1Based})
- Official title: **${title}**
- Body must contain ONLY: ${onlyLine}.
- Slide title must appear **once** at deck level only — do **not** repeat "${title}" inside the body.
${notLine ? `- Must NOT include: ${notLine}.` : ""}
- Formatting: plain lines for projection; match the same concise style as other slides.`;
}

export function validatePptSlideBody(
  body: string,
  ctx: PptSlideValidationContext,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const t = body.trim();
  if (!t) {
    reasons.push("empty body");
    return { ok: false, reasons };
  }

  const title = getStructuredLessonSlideTitle(ctx.slideNumber1Based - 1, ctx.isAr, ctx.uaeFrameworkSelected);
  const titleLc = title.toLowerCase();
  const lines = t.replace(/\r\n/g, "\n").split("\n");
  let titleEchoCount = 0;
  for (const line of lines) {
    const lc = line.trim().toLowerCase();
    if (lc === titleLc || lc.startsWith(`${titleLc}:`)) titleEchoCount += 1;
  }
  if (titleEchoCount > 0) {
    reasons.push("slide title repeated inside body");
  }

  const deny = CROSS_SLIDE_DENY[ctx.slideNumber1Based];
  if (deny) {
    for (const line of lines) {
      if (deny.some((re) => re.test(line))) {
        reasons.push(`forbidden cross-slide content: "${line.slice(0, 48)}…"`);
        break;
      }
    }
  }

  if (ctx.slideNumber1Based === 5 && ctx.teacherObjectives?.trim()) {
    const msg = slide5OutcomesValidationMessage(t, ctx.teacherObjectives, ctx.isAr);
    if (msg) reasons.push(msg);
  }

  if (ctx.slideNumber1Based === 7) {
    const s7 = validateSlide7DifferentiatedBody(t);
    if (!s7.ok) reasons.push(...s7.reasons);
  }

  if (ctx.slideNumber1Based === 8) {
    if (ctx.uaeFrameworkSelected) {
      if (!UAE_EXPECTED_WHEN_ON.test(t)) {
        reasons.push("UAE framework on but body lacks UAE-specific references");
      }
    } else if (UAE_FORBIDDEN_WHEN_OFF.test(t)) {
      reasons.push("UAE framework off but body mentions UAE-specific content");
    }
  }

  if (/\b(?:next\s+slide|slide\s*\d+|following\s+slide)\b/i.test(t)) {
    reasons.push("references another slide number");
  }

  return { ok: reasons.length === 0, reasons };
}

export type PptSlideSanitizeContext = EarlySlideSanitizeContext & {
  uaeFrameworkSelected: boolean;
};

/** Post-process any slide body: early slides use dedicated sanitizer; all slides strip UAE when off. */
export function sanitizePptSlideBody(
  slideNumber1Based: number,
  body: string,
  ctx: PptSlideSanitizeContext,
): string {
  if (slideNumber1Based === 1) {
    return buildProgrammaticSlide1Body(ctx.grade, ctx.dateStr ?? "");
  }
  if (slideNumber1Based === 4 && ctx.teacherObjectives?.trim()) {
    return buildTeacherObjectivesSlide4Body(ctx.teacherObjectives);
  }

  let out =
    slideNumber1Based <= 5
      ? sanitizeEarlyPptSlideBody(slideNumber1Based, body, ctx)
      : body.replace(/\r\n/g, "\n").trim();

  if (slideNumber1Based === 5 && ctx.teacherObjectives?.trim()) {
    out = sanitizeSlide5OutcomesBody(out, ctx.teacherObjectives, ctx.isAr);
  }

  if (slideNumber1Based === 7) {
    out = sanitizeSlide7DifferentiatedBody(out);
  }

  if (slideNumber1Based === 8 && !ctx.uaeFrameworkSelected) {
    out = out
      .replace(/\r\n/g, "\n")
      .split("\n")
      .filter((line) => !UAE_FORBIDDEN_WHEN_OFF.test(line))
      .join("\n")
      .trim();
  }

  return out;
}

export function resolveUaeFrameworkForPpt(curriculumFramework: string): boolean {
  return isUaeCurriculumFramework(curriculumFramework);
}

export { STRUCTURED_LESSON_DECK_SLIDE_COUNT };
