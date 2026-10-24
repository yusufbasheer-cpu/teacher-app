import { describe, expect, it } from "vitest";
import { AFL_PHASE_GROUPS } from "@/lib/afl-tools";
import { buildPptxFromPptContent } from "@/lib/lesson-plan-export";
import { getStructuredLessonSlideTitles } from "@/lib/ppt-structured-lesson";
import { assembleFullPptFromSlideBodies } from "@/lib/ppt-slide-by-slide";
import {
  adaptLegacyLessonPlanToDeck,
  projectDeckToLegacyExport,
} from "@/lib/slide-deck-legacy-adapter";

function legacyFixture(options: { arabic?: boolean; images?: (string | null)[] } = {}) {
  const isArabic = options.arabic ?? false;
  const titles = getStructuredLessonSlideTitles(isArabic, false);
  const bodies = titles.map((_, index) => `Legacy slide ${index + 1} body\nSecond line for slide ${index + 1}.`);
  const notes = titles.map((_, index) => `Teacher note ${index + 1}.`);
  const ppt = assembleFullPptFromSlideBodies(bodies, isArabic, false, notes);
  return {
    titles,
    bodies,
    notes,
    plan: {
      "PPT Slide Content": ppt,
      "Full Lesson Plan": "Full lesson source text remains in the saved lesson plan.",
      ...(options.images ? { __pptSlideImageUrls: JSON.stringify(options.images) } : {}),
    },
  };
}

describe("legacy lesson-plan slide adapter", () => {
  it("converts all 13 canonical slides without rewriting their titles or student-facing text", () => {
    const fixture = legacyFixture();
    const result = adaptLegacyLessonPlanToDeck({
      lessonPlan: fixture.plan,
      subject: "Science",
      grade: "Grade 5",
      topic: "The Water Cycle",
      deckId: "saved-lesson-123",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.id).toBe("saved-lesson-123");
    expect(result.deck.slides).toHaveLength(13);
    expect(result.deck.slides.map((slide) => slide.order)).toEqual(Array.from({ length: 13 }, (_, index) => index));
    expect(result.deck.slides.map((slide) => slide.title)).toEqual(fixture.titles);
    expect(result.deck.slides[5]!.contentBlocks).toEqual([
      { type: "paragraph", text: fixture.bodies[5] },
    ]);
    expect(result.deck.slides[5]!.speakerNotes).toBe(fixture.notes[5]);
    expect(result.deck.slides[5]!.centralTakeaway).toBeNull();

    const repeat = adaptLegacyLessonPlanToDeck({
      lessonPlan: JSON.stringify(fixture.plan),
      subject: "Science",
      grade: "Grade 5",
      topic: "The Water Cycle",
      deckId: "saved-lesson-123",
    });
    expect(repeat.ok).toBe(true);
    if (repeat.ok) expect(repeat.deck.slides.map((slide) => slide.id)).toEqual(result.deck.slides.map((slide) => slide.id));
  });

  it("preserves slide image URLs, language, RTL direction, and available teacher-selected AFL IDs", () => {
    const images: (string | null)[] = Array(13).fill(null);
    images[1] = "https://fal.media/files/slide-2.png";
    images[8] = "https://images.pexels.com/photos/example.jpeg";
    const english = legacyFixture({ images });
    const starterTool = AFL_PHASE_GROUPS.find((group) => group.phase === "starter")!.tools[0]!.id;
    const result = adaptLegacyLessonPlanToDeck({
      lessonPlan: english.plan,
      subject: "Science",
      grade: "Grade 5",
      topic: "The Water Cycle",
      aflSelections: { starter: [starterTool] },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.slides[1]!.image?.url).toBe(images[1]);
    expect(result.deck.slides[8]!.image?.url).toBe(images[8]);
    expect(result.deck.slides[1]!.afl).toEqual({
      phase: "starter",
      selectedToolIds: [starterTool],
      provenance: "teacher-selected",
    });

    const arabicFixture = legacyFixture({ arabic: true });
    const arabic = adaptLegacyLessonPlanToDeck({
      lessonPlan: arabicFixture.plan,
      subject: "Science",
      grade: "Grade 5",
      topic: "دورة الماء",
      language: "ar",
    });
    expect(arabic).toMatchObject({ ok: true, deck: { language: "ar", textDirection: "rtl" } });
    if (arabic.ok) expect(arabic.deck.slides[1]!.title).toBe(arabicFixture.titles[1]);

    // The saved lesson_plans row has no language column; canonical Arabic headings recover it.
    const inferredArabic = adaptLegacyLessonPlanToDeck({
      lessonPlan: arabicFixture.plan,
      subject: "Science",
      grade: "Grade 5",
      topic: "دورة الماء",
    });
    expect(inferredArabic).toMatchObject({ ok: true, deck: { language: "ar", textDirection: "rtl" } });

    const legacyArabicSubject = adaptLegacyLessonPlanToDeck({
      lessonPlan: legacyFixture({ arabic: true }).plan,
      subject: "Arabic",
      grade: "Grade 5",
    });
    expect(legacyArabicSubject).toMatchObject({ ok: true, deck: { language: "ar", textDirection: "rtl" } });
  });

  it("reports empty, malformed, incomplete, and ambiguous legacy input instead of dropping it", () => {
    expect(adaptLegacyLessonPlanToDeck({ lessonPlan: {}, subject: "Science", grade: "Grade 5" })).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "missing_ppt_content" })],
    });
    expect(adaptLegacyLessonPlanToDeck({ lessonPlan: "{broken", subject: "Science", grade: "Grade 5" })).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "malformed_lesson_plan_json" })],
    });
    expect(adaptLegacyLessonPlanToDeck({ lessonPlan: { "PPT Slide Content": "unrecognized content" }, subject: "Science", grade: "Grade 5" })).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "unrecognized_ppt_content" })],
    });

    const fixture = legacyFixture();
    const missingTitle = fixture.titles.slice(0, 12).map((title, index) => `${title}\nBody ${index + 1}`).join("\n\n");
    expect(adaptLegacyLessonPlanToDeck({ lessonPlan: { "PPT Slide Content": missingTitle }, subject: "Science", grade: "Grade 5" })).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "incomplete_ppt_content" })],
    });

    const preamble = `Unassigned note\n\n${fixture.plan["PPT Slide Content"]}`;
    expect(adaptLegacyLessonPlanToDeck({ lessonPlan: { "PPT Slide Content": preamble }, subject: "Science", grade: "Grade 5" })).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "unassigned_ppt_content" })],
    });

    const invalidImages = { ...fixture.plan, __pptSlideImageUrls: "{not-json" };
    expect(adaptLegacyLessonPlanToDeck({ lessonPlan: invalidImages, subject: "Science", grade: "Grade 5" })).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "malformed_image_metadata" })],
    });

    const malformedNotes = {
      ...fixture.plan,
      "PPT Slide Content": fixture.plan["PPT Slide Content"].replace(
        /<!--__LAYAH_TEACHER_NOTES__[\s\S]*$/,
        "<!--__LAYAH_TEACHER_NOTES__{broken}-->",
      ),
    };
    expect(adaptLegacyLessonPlanToDeck({ lessonPlan: malformedNotes, subject: "Science", grade: "Grade 5" })).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "malformed_teacher_notes" })],
    });

    const emptySlide = {
      ...fixture.plan,
      "PPT Slide Content": fixture.plan["PPT Slide Content"].replace(
        `${fixture.titles[0]}\n${fixture.bodies[0]}`,
        `${fixture.titles[0]}\n`,
      ),
    };
    expect(adaptLegacyLessonPlanToDeck({ lessonPlan: emptySlide, subject: "Science", grade: "Grade 5" })).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "empty_slide_body" })],
    });
  });

  it("preserves the current 13-slide export contract and supplies the existing PptxGenJS exporter", async () => {
    const images: (string | null)[] = Array(13).fill(null);
    images[1] = "https://fal.media/files/slide-2.png";
    const fixture = legacyFixture({ images });
    const adapted = adaptLegacyLessonPlanToDeck({
      lessonPlan: fixture.plan,
      subject: "Science",
      grade: "Grade 5",
      topic: "The Water Cycle",
    });
    expect(adapted.ok).toBe(true);
    if (!adapted.ok) return;

    const projection = projectDeckToLegacyExport(adapted.deck);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.slides).toHaveLength(13);
    expect(projection.value.slides[5]).toMatchObject({
      slideTitle: fixture.titles[5],
      body: fixture.bodies[5],
      speakerNotes: fixture.notes[5],
      includeImageSlot: true,
    });
    expect(projection.value.slideImageUrls[1]).toBe(images[1]);

    // This is the unchanged export API and input model consumed by the current renderer.
    const pptx = await buildPptxFromPptContent({
      subject: "Science",
      grade: "Grade 5",
      topic: "The Water Cycle",
      pptContent: fixture.plan["PPT Slide Content"],
      structuredSlides: projection.value.slides,
      slideImageUrls: Array(13).fill(null),
    });
    expect(pptx.byteLength).toBeGreaterThan(0);

    const schemaDeck = {
      ...adapted.deck,
      slides: adapted.deck.slides.map((slide) => ({ ...slide, image: undefined })),
    };
    const schemaPptx = await buildPptxFromPptContent({
      subject: "Science",
      grade: "Grade 5",
      topic: "The Water Cycle",
      pptContent: fixture.plan["PPT Slide Content"],
      deckSpec: schemaDeck,
    });
    expect(schemaPptx.byteLength).toBeGreaterThan(0);
  });
});

