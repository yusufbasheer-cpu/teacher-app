/**
 * Arabic must be a presentation-wide constraint, not a hint in one prompt.
 *
 * Two halves to this: the prompts must require Arabic for *every* returned field (the old
 * behaviour produced Arabic slide titles stapled onto English bodies), and the strings the
 * renderer inserts itself must be Arabic too.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateSlide2,
  generateSlide4Body,
  generateSlide5,
  generateSlide6,
  generateSlide7,
  generateSlide13Body,
  type SlideGenParams,
} from "./ppt-individual-slide-generator";
import { sanitizeSlide7DifferentiatedBody } from "./ppt-slide-by-slide";
import { PPT_STRINGS } from "./ppt-language";

const BASE: SlideGenParams = {
  topic: "دورة الماء",
  subject: "العلوم",
  grade: "الصف الخامس",
  chapter: "الماء",
  curriculumType: "MOE",
  learningObjectives: "أن يشرح الطالب مراحل دورة الماء.",
  uaeFrameworkEnabled: false,
  dateStr: "الجمعة، 4 سبتمبر 2026",
};

type Captured = { system: string; user: string };

function mockDeepSeek(): { calls: Captured[] } {
  const calls: Captured[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as {
        messages: { role: string; content: string }[];
      };
      calls.push({
        system: body.messages.find((m) => m.role === "system")?.content ?? "",
        user: body.messages.find((m) => m.role === "user")?.content ?? "",
      });
      // Long enough to clear every slide's quality gate — a short body triggers the
      // generator's retry loop and turns "one call per slide" into three.
      const content = Array.from(
        { length: 8 },
        (_, i) => `سطر ${i + 1}: محتوى تعليمي مولد لهذه الشريحة حول دورة الماء في الطبيعة.`,
      ).join("\n");
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
      });
    }),
  );
  return { calls };
}

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prompt construction requires Arabic everywhere", () => {
  it("puts the language directive in every AI slide's system prompt", async () => {
    const { calls } = mockDeepSeek();
    const p = { ...BASE, language: "ar" as const };
    await Promise.all([generateSlide2(p), generateSlide5(p), generateSlide6(p), generateSlide7(p)]);

    expect(calls.length).toBe(4);
    for (const call of calls) {
      expect(call.system).toContain("OUTPUT LANGUAGE (ABSOLUTE REQUIREMENT)");
      expect(call.system).toContain("Modern Standard Arabic");
    }
  });

  it("covers every textual field, not just the main body", async () => {
    const { calls } = mockDeepSeek();
    await generateSlide6({ ...BASE, language: "ar" });

    const system = calls[0]!.system;
    // The failure mode was Arabic titles over English content, so the instruction has to
    // enumerate the other fields explicitly.
    for (const field of [
      "headings",
      "instructions",
      "activity names and steps",
      "explanations",
      "questions",
      "examples",
      "teacher instructions",
      "student instructions",
      "labels",
      "captions",
    ]) {
      expect(system).toContain(field);
    }
  });

  it("forbids transliterating Arabic into Latin characters", async () => {
    const { calls } = mockDeepSeek();
    await generateSlide2({ ...BASE, language: "ar" });
    expect(calls[0]!.system).toContain("Do NOT transliterate");
  });

  it("carves out the teacher's own proper nouns and technical terms", async () => {
    const { calls } = mockDeepSeek();
    await generateSlide2({ ...BASE, language: "ar" });
    const system = calls[0]!.system;
    // Without this the model would translate or transliterate names and acronyms the teacher
    // deliberately supplied — a naive "Arabic only" rule is wrong, not stricter.
    expect(system).toContain("PERMITTED EXCEPTIONS");
    expect(system).toContain("Proper nouns");
    expect(system).toContain("acronyms");
  });

  it("asks for English on an English deck and never mentions the Arabic requirement", async () => {
    const { calls } = mockDeepSeek();
    await generateSlide2({ ...BASE, subject: "Science", topic: "The Water Cycle", language: "en" });

    const system = calls[0]!.system;
    expect(system).toContain("clear English appropriate for the grade");
    expect(system).not.toContain("Modern Standard Arabic");
  });
});

describe("programmatic slides follow the deck language", () => {
  it("writes the closing slide in Arabic", () => {
    const ar = generateSlide13Body({ ...BASE, language: "ar" }).body;
    const en = generateSlide13Body({ ...BASE, language: "en" }).body;

    expect(ar).toMatch(/[؀-ۿ]/);
    expect(ar).not.toContain("Thank you");
    expect(en).toContain("Thank you");
  });

  it("uses the Arabic placeholder when objectives are genuinely missing", () => {
    const body = generateSlide4Body({ ...BASE, learningObjectives: "", language: "ar" }).body;
    expect(body).toBe(PPT_STRINGS.ar.objectivesNotProvided);
    expect(body).not.toContain("Learning objectives");
  });
});

describe("slide 7 keeps Arabic content instead of replacing it with English defaults", () => {
  const arabicTiers = [
    "مهمة للمتفوقين",
    "صمّم نموذجاً يوضح دورة الماء مع شرح مكتوب.",
    "مهمة للمستوى المتوسط",
    "أكمل مخططاً لمراحل دورة الماء واذكر مثالاً لكل مرحلة.",
    "مهمة للمستوى الأساسي",
    "رتّب البطاقات المصورة لمراحل دورة الماء بمساعدة المعلم.",
  ].join("\n");

  it("recognises Arabic tier headings and preserves their content", () => {
    const body = sanitizeSlide7DifferentiatedBody(arabicTiers, "دورة الماء", "ar");

    // The old classifier only matched English headings, so every tier came back empty and was
    // replaced by an English default task — content loss, not just a label leak.
    expect(body).toContain("صمّم نموذجاً يوضح دورة الماء");
    expect(body).toContain("أكمل مخططاً لمراحل دورة الماء");
    expect(body).toContain("رتّب البطاقات المصورة");
  });

  it("emits Arabic tier labels and mini-plenary heading", () => {
    const body = sanitizeSlide7DifferentiatedBody(arabicTiers, "دورة الماء", "ar");

    expect(body).toContain(PPT_STRINGS.ar.slide7Higher);
    expect(body).toContain(PPT_STRINGS.ar.slide7MiniPlenary);
    expect(body).not.toContain("Higher Achievers task");
    expect(body).not.toContain("Mini Plenary");
  });

  it("keeps the real Arabic mini-plenary content and emits its heading once", () => {
    const withPlenary = `${arabicTiers}\nتلخيص مصغر\nاذكر مرحلة واحدة من دورة الماء وفسّر أهميتها.`;
    const body = sanitizeSlide7DifferentiatedBody(withPlenary, "دورة الماء", "ar");

    // The Arabic heading did not switch the parser's mode, so it and its content were absorbed
    // into the last tier and the formatter appended its own heading plus a default — the label
    // appeared twice and the teacher's mini-plenary text was lost.
    expect(body).toContain("اذكر مرحلة واحدة من دورة الماء");
    expect(body.split(PPT_STRINGS.ar.slide7MiniPlenary).length - 1).toBe(1);
    // The generic default must not have been substituted over real content.
    expect(body).not.toContain("اشرح في جملة واحدة أهم ما تعلمته");
  });

  it("leaves the English deck's labels exactly as they were", () => {
    const body = sanitizeSlide7DifferentiatedBody(
      "Higher Achievers task\nDesign a model.\nMiddle Achievers task\nComplete the diagram.\nLower Achievers task\nSort the picture cards.",
      "The Water Cycle",
      "en",
    );
    expect(body).toContain("Higher Achievers task");
    expect(body).toContain("Mini Plenary");
    expect(body).not.toMatch(/[؀-ۿ]/);
  });
});

describe("English leakage detection", () => {
  it("finds no English template strings in an Arabic deck's static text", () => {
    // Checks the strings the *renderer* inserts. Deliberately not a rule against any Latin
    // character: a teacher's acronym or product name is legitimate Arabic-deck content.
    const englishTemplateStrings = Object.values(PPT_STRINGS.en);
    const arabicTemplateStrings = Object.values(PPT_STRINGS.ar);

    for (const en of englishTemplateStrings) {
      expect(arabicTemplateStrings).not.toContain(en);
    }
  });

  it("allows Latin technical terms inside otherwise-Arabic content", () => {
    const body = sanitizeSlide7DifferentiatedBody(
      "مهمة للمتفوقين\nاستخدم Microsoft Excel لتحليل بيانات الطقس.",
      "الطقس",
      "ar",
    );
    expect(body).toContain("Microsoft Excel");
  });
});
