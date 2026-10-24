import { describe, expect, it } from "vitest";
import {
  estimateSlideText,
  paginateSlideForComposition,
  paginateToFit,
  selectCompositionForSlide,
  selectDeckCompositions,
} from "./slide-layout-engine";
import { SLIDE_COMPOSITION_REGISTRY } from "./slide-composition-registry";
import { adaptStructuredLessonSlidesToDeck } from "./slide-deck-legacy-adapter";
import type { StructuredLessonSlideModel } from "./ppt-structured-lesson";
import type { DeckSpec, EducationalContentBlock, PedagogicalPurpose, SlideSpec } from "./slide-schema";

function slide(
  purpose: PedagogicalPurpose,
  block: EducationalContentBlock,
  id = "slide-test-1",
  composition?: SlideSpec["composition"],
): SlideSpec {
  return {
    id,
    order: 0,
    title: "Learning slide",
    pedagogicalPurpose: purpose,
    centralTakeaway: null,
    contentBlocks: [block],
    layoutIntent: { image: "avoid" },
    ...(composition ? { composition } : {}),
    speakerNotes: "Use one response to check understanding.",
  };
}

function deck(slides: SlideSpec[]): DeckSpec {
  return {
    id: "deck-composition-tests",
    schemaVersion: 1,
    subject: "Science",
    grade: "Grade 8",
    topic: "Learning systems",
    language: "en",
    textDirection: "ltr",
    theme: { id: "classic" },
    slides: slides.map((item, order) => ({ ...item, order, id: `slide-test-${order + 1}` })),
  };
}

describe("education composition registry and selector", () => {
  it("defines distinct pedagogical structures for every schema composition", () => {
    const definitions = Object.values(SLIDE_COMPOSITION_REGISTRY);
    expect(definitions).toHaveLength(12);
    expect(new Set(definitions.map((definition) => definition.id)).size).toBe(12);
    for (const definition of definitions) {
      expect(definition.version).toBe(1);
      expect(Object.keys(definition.regions).length).toBeGreaterThan(0);
      expect(definition.hierarchy.length).toBeGreaterThan(1);
      expect(definition.minimumBodyFontPt).toBeGreaterThanOrEqual(15);
    }
  });

  it.each([
    ["concept-explanation", { type: "paragraph", text: "A habitat supplies organisms with food, water, shelter, and space." }, "concept-focus"],
    ["concept-explanation", { type: "workedExample", prompt: "Find 3/4 of 20.", steps: [{ work: "20 ÷ 4 = 5", reasoning: "Find one quarter." }, { work: "5 × 3 = 15" }], result: "3/4 of 20 is 15." }, "worked-example-steps"],
    ["diagram", { type: "diagram", nodes: [{ id: "sun", label: "Sun", kind: "source" }, { id: "plant", label: "Plant" }, { id: "sugar", label: "Sugar" }], connections: [{ from: "sun", to: "plant", label: "light energy" }, { from: "plant", to: "sugar", label: "stored as" }] }, "labeled-diagram"],
    ["process", { type: "orderedSteps", items: ["Observe the sample.", "Record its properties.", "Compare the evidence."] }, "process-flow"],
    ["comparison", { type: "comparison", criteria: ["State", "Keeps shape"], items: [{ label: "Ice", values: ["Solid", "Yes"] }, { label: "Water", values: ["Liquid", "No"] }] }, "comparison-matrix"],
    ["learning-objectives", { type: "bulletList", items: ["Describe a habitat.", "Explain one adaptation."] }, "objective-checklist"],
    ["classroom-activity", { type: "task", instructions: ["Sort the organism cards.", "Explain one grouping choice."], materials: ["organism cards"], timeMinutes: 8 }, "activity-brief"],
    ["formative-assessment", { type: "question", prompt: "Which change is reversible?", options: [{ id: "a", text: "Melting ice" }, { id: "b", text: "Burning paper" }], correctOptionIds: ["a"] }, "hinge-question"],
    ["plenary", { type: "question", prompt: "What evidence supports your answer?", options: [{ id: "a", text: "Observation" }, { id: "b", text: "A guess" }] }, "retrieval-practice"],
    ["reflection", { type: "reflection", prompts: ["Which idea changed your thinking?"], sentenceStarters: ["At first I thought…", "Now I can explain…"] }, "reflection-prompt"],
    ["summary", { type: "diagram", nodes: [{ id: "idea", label: "Energy transfer", kind: "central" }, { id: "sun", label: "Sunlight" }, { id: "food", label: "Stored in food" }], connections: [{ from: "idea", to: "sun" }, { from: "idea", to: "food" }] }, "summary-map"],
  ] as const)("selects %s content into its educational composition", (purpose, block, expected) => {
    const result = selectCompositionForSlide(slide(purpose, block as EducationalContentBlock), { grade: "Grade 8" });
    expect("error" in result ? null : result.composition).toBe(expected);
  });

  it("selects the same composition and variant for identical input", () => {
    const input = slide("worked-example", { type: "orderedSteps", items: ["Balance both sides.", "Solve for x.", "Check the result."] });
    expect(selectCompositionForSlide(input, { grade: "Grade 9" })).toEqual(selectCompositionForSlide(input, { grade: "Grade 9" }));
  });

  it("falls back when a requested composition cannot represent the structured block", () => {
    const result = selectCompositionForSlide(
      slide("diagram", { type: "diagram", nodes: [{ id: "a", label: "Input" }, { id: "b", label: "Output" }], connections: [{ from: "a", to: "b", label: "transforms into" }] }, "slide-fallback", "comparison-matrix"),
      { grade: "Grade 8" },
    );
    expect(result).toMatchObject({ composition: "labeled-diagram", usedFallback: true });
  });

  it("reports when a slide explicitly requires an image that is unavailable", () => {
    const input = slide("concept-explanation", { type: "paragraph", text: "Observe the structure." });
    input.layoutIntent.image = "required";
    expect(selectCompositionForSlide(input, { grade: "Grade 8" })).toMatchObject({ error: { code: "required_image_unavailable" } });
  });

  it("reports when an image-required slide has structured content that no image composition can render", () => {
    const input = slide("diagram", {
      type: "diagram",
      nodes: [{ id: "source", label: "Source" }, { id: "result", label: "Result" }],
      connections: [{ from: "source", to: "result", label: "becomes" }],
    });
    input.image = { url: "https://images.example.test/system.png" };
    input.layoutIntent.image = "required";
    expect(selectCompositionForSlide(input, { grade: "Grade 8" })).toMatchObject({ error: { code: "required_image_unsupported" } });
  });

  it("stores final composition IDs and variants on the normalized deck", () => {
    const result = selectDeckCompositions(deck([
      slide("learning-objectives", { type: "bulletList", items: ["Identify the pattern.", "Explain the rule."] }),
      slide("classroom-activity", { type: "task", instructions: ["Test the rule with three values."] }),
    ]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deck.slides.map((item) => item.composition)).toEqual(["objective-checklist", "activity-brief"]);
      expect(result.deck.slides.every((item) => Boolean(item.compositionVariant))).toBe(true);
    }
  });
});

describe("density and semantic continuation", () => {
  it("counts paragraph sentences as density items", () => {
    const value = slide("concept-explanation", { type: "paragraph", text: "First idea. Second idea. Third idea." });
    expect(estimateSlideText(value).items).toBe(3);
  });

  it("does not budget an exact central-takeaway duplicate twice", () => {
    const value = slide("concept-explanation", { type: "paragraph", text: "One idea appears once." });
    value.centralTakeaway = "One idea appears once.";
    expect(estimateSlideText(value).characters).toBe("One idea appears once.".length);
  });

  it("splits dense paragraphs at readable semantic boundaries without losing text", () => {
    const original = Array.from({ length: 18 }, (_, index) => `Evidence point ${index + 1}: learners compare the sample with the model and record one reason for the difference.`).join(" ");
    const value = slide("concept-explanation", { type: "paragraph", text: original });
    value.image = { url: "https://images.example.test/lesson.png", fit: "contain" };
    const selected = selectCompositionForSlide(value, { grade: "Grade 8" });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    const paged = paginateSlideForComposition({ ...value, composition: selected.composition, compositionVariant: selected.variant });
    expect(paged.ok).toBe(true);
    if (paged.ok) {
      expect(paged.slides.length).toBeGreaterThan(1);
      const stitched = paged.slides.flatMap((part) => part.contentBlocks).flatMap((block) => block.type === "paragraph" ? [block.text] : []).join("");
      expect(stitched.replace(/\s+/g, " ").trim()).toBe(original.replace(/\s+/g, " ").trim());
      expect(paged.slides[0]?.image?.url).toBe("https://images.example.test/lesson.png");
      expect(paged.slides.slice(1).every((part) => part.image === undefined)).toBe(true);
      expect(paged.slides[1]?.speakerNotes).toContain("See the teacher notes on its first page");
      expect(paged.slides[1]?.speakerNotes).not.toContain("Use one response to check understanding.");
    }
  });

  it("returns a bounded error when semantic pagination would exceed the physical slide budget", () => {
    const original = Array.from({ length: 18 }, (_, index) => `Evidence point ${index + 1}: learners compare the sample with the model and record one reason for the difference.`).join(" ");
    const value = slide("concept-explanation", { type: "paragraph", text: original });
    const result = paginateToFit(value, false, () => "concept-focus", () => "", 1);
    expect(result).toMatchObject({ ok: false, code: "maximum_slide_count_exceeded" });
  });

  it("returns an explicit error for oversized indivisible diagrams", () => {
    const oversized = slide("diagram", {
      type: "diagram",
      nodes: [{ id: "a", label: "A".repeat(600) }, { id: "b", label: "B".repeat(600) }],
      connections: [{ from: "a", to: "b", label: "C".repeat(100) }],
    });
    const paged = paginateSlideForComposition({ ...oversized, composition: "labeled-diagram" });
    expect(paged).toMatchObject({ ok: false, code: "structured_block_exceeds_composition_capacity" });
  });

  it("converts the current 13-role slide model into selected specs without losing body text or notes", () => {
    const body = Array.from({ length: 35 }, (_, index) => `Legacy content point ${index + 1} explains the evidence and its meaning.`).join("\n");
    const models: StructuredLessonSlideModel[] = Array.from({ length: 13 }, (_, index) => ({
      slideTitle: `Lesson section ${index + 1}`,
      body: `Student-facing content for section ${index + 1}.`,
      speakerNotes: `Teacher notes for section ${index + 1}.`,
      includeImageSlot: false,
    }));
    models[5]!.body = body;
    const adapted = adaptStructuredLessonSlidesToDeck({ slides: models, subject: "Science", grade: "Grade 8", topic: "Energy" });
    expect(adapted.ok).toBe(true);
    if (adapted.ok) {
      expect(adapted.deck.slides[5]!.contentBlocks).toEqual([{ type: "paragraph", text: body }]);
      expect(adapted.deck.slides[5]!.speakerNotes).toBe("Teacher notes for section 6.");
      expect(adapted.deck.slides.every((item) => Boolean(item.composition))).toBe(true);
    }
  });
});
