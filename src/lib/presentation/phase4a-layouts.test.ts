import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildStructuredLessonSlides } from "@/lib/ppt-structured-lesson";
import { adaptStructuredLessonSlidesToDeck } from "@/lib/slide-deck-legacy-adapter";
import { buildPptxFromDeckSpec } from "@/lib/ppt-template-engine";
import { classifyStarterActivity } from "@/lib/ppt-layouts/title-starter-provisional";
import { getRegisteredLayoutsForSlideType } from "@/lib/presentation/layout-registry";
import { selectStarterLayout, selectTitleLayout } from "@/lib/presentation/layout-selector";

const starterBody = "Predict and justify\n\nStudy the example. Predict what will happen and explain your reasoning.\n\nCompare your prediction with a partner, then revise one sentence.";

function makeDeck() {
  const slides = buildStructuredLessonSlides({
    subject: "Science",
    grade: "Year 7",
    topic: "The Water Cycle",
    teacherName: "Phase 4A Review",
    learningObjectivesText: "Explain evaporation and condensation using particle movement.",
    language: "en",
  }).map((slide, index) => index === 1 ? { ...slide, body: starterBody } : slide);
  const adapted = adaptStructuredLessonSlidesToDeck({
    slides,
    subject: "Science",
    grade: "Year 7",
    topic: "The Water Cycle",
    language: "en",
    themeId: "modern",
    deckId: "phase4a-water-cycle",
  });
  if (!adapted.ok) throw new Error(adapted.issues.map((issue) => issue.message).join("; "));
  return adapted.deck;
}

async function slideXmls(buffer: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => Number(left.match(/\d+/)?.[0]) - Number(right.match(/\d+/)?.[0]));
  return Promise.all(names.map((name) => zip.file(name)!.async("string")));
}

describe("Phase 4A title and starter layout registry", () => {
  it("registers two provisional coded variants per slide type", () => {
    expect(getRegisteredLayoutsForSlideType("title").map((layout) => layout.id)).toEqual(["title_hero_01", "title_typography_01"]);
    expect(getRegisteredLayoutsForSlideType("starter").map((layout) => layout.id)).toEqual(["starter_activity_brief_01", "starter_visual_prompt_01"]);
    for (const layout of [...getRegisteredLayoutsForSlideType("title"), ...getRegisteredLayoutsForSlideType("starter")]) {
      expect(layout.contentLimits.provisional).toBe(true);
      expect(layout.contentLimits.slots.length).toBeGreaterThan(0);
      expect(layout.render).toBeTypeOf("function");
    }
  });

  it("uses the hero title only with an image and keeps typography as the complete fallback", () => {
    const base = { topic: "The Water Cycle", subject: "Science", grade: "Year 7" };
    const noImage = selectTitleLayout({ enabled: true, lessonId: "lesson-a", slideId: "slide-1", content: { ...base, hasImage: false } });
    expect(noImage).toMatchObject({ kind: "registered", layout: { id: "title_typography_01" } });
    const withImage = selectTitleLayout({ enabled: true, lessonId: "lesson-a", slideId: "slide-1", content: { ...base, hasImage: true }, requestedLayoutId: "title_hero_01" });
    expect(withImage).toMatchObject({ kind: "registered", layout: { id: "title_hero_01" } });
  });

  it("is deterministic and preserves starter activity classification", () => {
    const content = { title: "Starter Activity", body: starterBody, activityKind: classifyStarterActivity(starterBody, ["st-think-pair-share"]), selectedToolIds: ["st-think-pair-share"], hasImage: false } as const;
    const results = Array.from({ length: 8 }, () => selectStarterLayout({ enabled: true, lessonId: "lesson-fixed", slideId: "slide-2", content }));
    expect(new Set(results.map((result) => result.kind === "registered" ? result.layout.id : result.reason)).size).toBe(1);
    expect(content.activityKind).toBe("discussion");
    expect(results[0]).toMatchObject({ kind: "registered", layout: { id: "starter_activity_brief_01" } });
    const picturePrompt = { ...content, body: "Observe the image and explain what evidence you notice.", activityKind: "picture-prompt" as const, hasImage: true };
    expect(selectStarterLayout({ enabled: true, lessonId: "lesson-fixed", slideId: "slide-2", content: picturePrompt })).toMatchObject({ kind: "registered", layout: { id: "starter_visual_prompt_01" } });
  });

  it("falls back safely for incompatible content or when the feature is disabled", () => {
    const title = { topic: "x".repeat(91), subject: "Science", grade: "Year 7", hasImage: false };
    expect(selectTitleLayout({ enabled: true, lessonId: "lesson", slideId: "slide-1", content: title })).toMatchObject({ kind: "legacy", reason: "no-compatible-layout" });
    expect(selectTitleLayout({ enabled: false, lessonId: "lesson", slideId: "slide-1", content: { ...title, topic: "Water" } })).toMatchObject({ kind: "legacy", reason: "feature-disabled" });
  });
});

describe("Phase 4A renderer integration", () => {
  it("changes only title and starter slides while preserving editable content, notes and later slides", async () => {
    const deck = makeDeck();
    const legacy = await buildPptxFromDeckSpec({ deck, templateId: "modern", phase4aLayout: "existing", learningObjectiveLayout: "existing" });
    const phase4a = await buildPptxFromDeckSpec({ deck, templateId: "modern", phase4aLayout: "title_typography_01", learningObjectiveLayout: "existing" });
    const [legacySlides, phase4aSlides] = await Promise.all([slideXmls(legacy), slideXmls(phase4a)]);
    expect(phase4aSlides).toHaveLength(legacySlides.length);
    expect(phase4aSlides[0]).not.toBe(legacySlides[0]);
    expect(phase4aSlides[1]).not.toBe(legacySlides[1]);
    phase4aSlides.forEach((xml, index) => {
      if (index > 1) expect(xml, `slide ${index + 1}`).toBe(legacySlides[index]);
    });
    expect(phase4aSlides[0]).toContain("The Water Cycle");
    expect(phase4aSlides[1]).toContain("Predict and justify");
    expect(phase4aSlides[1]).toContain("Compare your prediction with a partner");
    const zip = await JSZip.loadAsync(phase4a);
    const notes = Object.keys(zip.files).filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name));
    expect(notes).toHaveLength(deck.slides.length);
  }, 30_000);

  it("keeps RTL decks on the legacy renderer until the provisional layouts are visually approved for Arabic", async () => {
    const deck = { ...makeDeck(), language: "ar" as const, textDirection: "rtl" as const };
    const legacy = await buildPptxFromDeckSpec({ deck, templateId: "modern", phase4aLayout: "existing", learningObjectiveLayout: "existing" });
    const requested = await buildPptxFromDeckSpec({ deck, templateId: "modern", phase4aLayout: "title_typography_01", learningObjectiveLayout: "existing" });
    expect(await slideXmls(requested)).toEqual(await slideXmls(legacy));
  }, 30_000);
});
