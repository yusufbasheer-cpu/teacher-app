/**
 * The Learning Objective must survive from the teacher's form to the slide.
 *
 * The reported bug was an Arabic objective rendering as "No Content Provided". That string is
 * the renderer's generic empty-body placeholder, not an LO-specific message: slide 4 is built
 * from the teacher's verbatim objectives and was then run through the cross-slide duplicate
 * filter, which deletes any line >=40 characters already seen on an earlier slide. When the
 * model echoed the objectives onto slide 3 or 5, the teacher's own words were removed and the
 * slide emptied. Arabic tripped it constantly because its lines clear 40 characters easily.
 */
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  buildStructuredLessonSlides,
  LEARNING_OBJECTIVES_SLIDE_INDEX as LO_IDX,
} from "./ppt-structured-lesson";
import { buildPptxFromTemplateEngine } from "./ppt-template-engine";
import { PPT_STRINGS } from "./ppt-language";

const AR_OBJECTIVE =
  "أن يشرح الطالب مراحل دورة الماء في الطبيعة ويوضح أهميتها للحياة على سطح الأرض.";
const EN_OBJECTIVE =
  "Students will explain each stage of the water cycle and describe why it matters for life on Earth.";
const MIXED_OBJECTIVE = "أن يستخدم الطالب برنامج Microsoft Excel لتنظيم بيانات الطقس.";

/**
 * A PPT outline that echoes the objectives on an earlier slide — the exact shape that used to
 * empty slide 4.
 */
function outlineEchoing(objective: string, isAr: boolean): string {
  const titles = isAr
    ? ["المادة والصف والتاريخ", "نشاط التمهيد", "الفصل والموضوع وهدف التنمية المستدامة", "الأهداف التعليمية", "نواتج التعلم"]
    : ["Subject, Grade, Date", "Starter Activity", "Chapter, Topic and SDG Goal", "Learning Objectives", "Learning Outcomes"];
  return [
    `${titles[0]}\nGrade 5`,
    // slide 3 repeats the objective verbatim — this is what the duplicate filter caught
    `${titles[2]}\n${objective}`,
    `${titles[3]}\n${objective}`,
    `${titles[4]}\n${objective}`,
  ].join("\n\n");
}

function build(objective: string, language: "en" | "ar") {
  const isAr = language === "ar";
  return buildStructuredLessonSlides({
    subject: isAr ? "العلوم" : "Science",
    grade: isAr ? "الصف الخامس" : "Grade 5",
    topic: isAr ? "دورة الماء" : "The Water Cycle",
    teacherName: "Teacher",
    learningObjectivesText: objective,
    pptContent: outlineEchoing(objective, isAr),
    language,
  });
}

describe("the objective reaches the presentation model", () => {
  it("keeps an Arabic objective even when an earlier slide repeats it", () => {
    const deck = build(AR_OBJECTIVE, "ar");
    expect(deck[LO_IDX]!.body).toContain(AR_OBJECTIVE);
  });

  it("keeps an English objective", () => {
    const deck = build(EN_OBJECTIVE, "en");
    expect(deck[LO_IDX]!.body).toContain(EN_OBJECTIVE);
  });

  it("keeps a mixed-script objective without romanising the Arabic", () => {
    const deck = build(MIXED_OBJECTIVE, "ar");
    const body = deck[LO_IDX]!.body;
    expect(body).toContain("Microsoft Excel");
    expect(body).toContain("أن يستخدم الطالب");
  });

  it("preserves multiple objective lines in order", () => {
    const lines = [
      "أن يعرّف الطالب مفهوم التبخر تعريفاً دقيقاً وواضحاً.",
      "أن يقارن الطالب بين التبخر والتكاثف بأمثلة من الحياة اليومية.",
    ];
    const deck = build(lines.join("\n"), "ar");
    const body = deck[LO_IDX]!.body;
    expect(body.indexOf(lines[0]!)).toBeGreaterThanOrEqual(0);
    expect(body.indexOf(lines[1]!)).toBeGreaterThan(body.indexOf(lines[0]!));
  });

  it("never substitutes a placeholder for a valid objective", () => {
    for (const [objective, lang] of [
      [AR_OBJECTIVE, "ar"],
      [EN_OBJECTIVE, "en"],
      [MIXED_OBJECTIVE, "ar"],
    ] as const) {
      const body = build(objective, lang)[LO_IDX]!.body;
      expect(body).not.toContain(PPT_STRINGS.en.noContentProvided);
      expect(body).not.toContain(PPT_STRINGS.ar.noContentProvided);
      expect(body).not.toContain(PPT_STRINGS.en.objectivesNotProvided);
    }
  });
});

describe("the placeholder still appears when it should", () => {
  it("shows it only when the objective is genuinely absent", () => {
    const deck = buildStructuredLessonSlides({
      subject: "Science",
      grade: "Grade 5",
      topic: "The Water Cycle",
      teacherName: "Teacher",
      learningObjectivesText: "   ",
      pptContent: "",
      language: "en",
    });
    expect(deck[LO_IDX]!.body.trim()).toBe("");
  });
});

describe("the objective reaches the rendered slide", () => {
  it("appears in the exported PPTX for Arabic", async () => {
    const deck = build(AR_OBJECTIVE, "ar");
    const buf = await buildPptxFromTemplateEngine({
      templateId: "classic",
      slides: deck,
      subject: "العلوم",
      grade: "الصف الخامس",
      topic: "دورة الماء",
      language: "ar",
    });
    const zip = await JSZip.loadAsync(buf);
    const xml = (
      await Promise.all(
        Object.keys(zip.files)
          .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
          .map((n) => zip.file(n)!.async("string")),
      )
    ).join("\n");

    // A distinctive fragment — the full sentence may be split across XML runs.
    expect(xml).toContain("مراحل دورة الماء");
    expect(xml).not.toContain("No content provided");
  });
});
