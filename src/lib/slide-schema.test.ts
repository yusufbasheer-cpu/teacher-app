import { describe, expect, it } from "vitest";
import { AFL_PHASE_GROUPS } from "@/lib/afl-tools";
import {
  DECK_SCHEMA_VERSION,
  EDUCATIONAL_COMPOSITION_IDS,
  MAX_DECK_SLIDES,
  MAX_DECK_TEXT_CHARACTERS,
  parseDeckSpec,
  type DeckSpec,
  type EducationalContentBlock,
} from "@/lib/slide-schema";

function validDeck(block: EducationalContentBlock = { type: "paragraph", text: "Fractions describe equal parts of a whole." }): DeckSpec {
  return {
    id: "deck-fractions-grade-4",
    schemaVersion: DECK_SCHEMA_VERSION,
    subject: "Math",
    grade: "Grade 4",
    topic: "Fractions",
    language: "en",
    textDirection: "ltr",
    theme: { id: "classic" },
    slides: [
      {
        id: "slide-fractions-01",
        order: 0,
        title: "Equal parts",
        pedagogicalPurpose: "concept-explanation",
        centralTakeaway: "A fraction names equal parts of a whole.",
        contentBlocks: [block],
        layoutIntent: { density: "light", emphasis: "concept", image: "avoid" },
        speakerNotes: "Ask learners to point out the whole first.",
      },
    ],
  };
}

describe("slide schema v1", () => {
  it("accepts a valid educational deck and composition registry entries", () => {
    expect(parseDeckSpec(validDeck()).ok).toBe(true);
    for (const composition of EDUCATIONAL_COMPOSITION_IDS) {
      const deck = validDeck();
      deck.slides[0]!.composition = composition;
      expect(parseDeckSpec(deck), composition).toMatchObject({ ok: true });
    }
  });

  it.each<EducationalContentBlock>([
    { type: "paragraph", text: "The Moon reflects sunlight." },
    { type: "keyIdea", label: "Remember", text: "The Moon does not make its own light." },
    { type: "bulletList", items: ["Observe", "Record", "Compare"] },
    { type: "orderedSteps", items: ["Measure", "Calculate", "Check"] },
    {
      type: "workedExample",
      prompt: "What is 3/4 of 20?",
      steps: [{ work: "20 ÷ 4 = 5", reasoning: "One quarter is 5." }, { work: "5 × 3 = 15" }],
      result: "3/4 of 20 is 15.",
    },
    {
      type: "diagram",
      nodes: [{ id: "sun", label: "Sun", kind: "source" }, { id: "earth", label: "Earth" }],
      connections: [{ from: "sun", to: "earth", label: "light travels to" }],
    },
    {
      type: "comparison",
      criteria: ["State", "Liquid"],
      items: [{ label: "Ice", values: ["solid", "no"] }, { label: "Water", values: ["liquid", "yes"] }],
    },
    { type: "task", instructions: ["Sort the cards.", "Explain one choice."], materials: ["cards"], timeMinutes: 5 },
    {
      type: "question",
      prompt: "Which number is even?",
      options: [{ id: "a", text: "7" }, { id: "b", text: "8" }],
      correctOptionIds: ["b"],
    },
    { type: "reflection", prompts: ["What changed in your thinking?"], sentenceStarters: ["At first I thought…"] },
  ])("accepts the %s block shape", (block) => {
    expect(parseDeckSpec(validDeck(block))).toMatchObject({ ok: true });
  });

  it("rejects unsupported versions, invalid IDs, and non-ascending slide order", () => {
    const unsupported = validDeck();
    (unsupported as { schemaVersion: number }).schemaVersion = 2;
    expect(parseDeckSpec(unsupported)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "unsupported_schema_version" })]) });

    const duplicate = validDeck();
    duplicate.slides.push({ ...duplicate.slides[0]!, order: 1 });
    expect(parseDeckSpec(duplicate)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "duplicate_id" })]) });

    const unordered = validDeck();
    unordered.slides.push({ ...unordered.slides[0]!, id: "slide-fractions-02", order: 0 });
    expect(parseDeckSpec(unordered)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "duplicate_order" })]) });

    const invalidId = validDeck();
    invalidId.slides[0]!.id = "slide id with spaces";
    expect(parseDeckSpec(invalidId)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "invalid_id" })]) });
  });

  it("rejects invalid diagram references and malformed comparison/question structures", () => {
    const diagram = validDeck({
      type: "diagram",
      nodes: [{ id: "input", label: "Input" }],
      connections: [{ from: "input", to: "missing" }],
    });
    expect(parseDeckSpec(diagram)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "unknown_diagram_node" })]) });

    const comparison = validDeck({
      type: "comparison",
      criteria: ["One", "Two"],
      items: [{ label: "A", values: ["only one value"] }, { label: "B", values: ["x", "y"] }],
    });
    expect(parseDeckSpec(comparison)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "criteria_value_count" })]) });

    const question = validDeck({ type: "question", prompt: "Choose.", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionIds: ["c"] });
    expect(parseDeckSpec(question)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "unknown_option" })]) });
  });

  it("validates language direction, composition IDs, image sources, and AFL phase/tool IDs", () => {
    const rtl = validDeck();
    rtl.language = "ar";
    expect(parseDeckSpec(rtl)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "language_direction_mismatch" })]) });

    const badComposition = validDeck();
    badComposition.slides[0]!.composition = "business-two-column" as never;
    expect(parseDeckSpec(badComposition)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "invalid_composition" })]) });

    const badImage = validDeck();
    badImage.slides[0]!.image = { url: "file:///private/photo.png" };
    expect(parseDeckSpec(badImage)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "invalid_url" })]) });

    const badAfl = validDeck();
    badAfl.slides[0]!.afl = {
      phase: "starter",
      selectedToolIds: [AFL_PHASE_GROUPS.find((group) => group.phase === "main")!.tools[0]!.id],
      provenance: "teacher-selected",
    };
    expect(parseDeckSpec(badAfl)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "unknown_afl_tool" })]) });
  });

  it("rejects payloads above the logical slide and text-size limits before layout work", () => {
    const tooManySlides = validDeck();
    tooManySlides.slides = Array.from({ length: MAX_DECK_SLIDES + 1 }, (_, index) => ({
      ...tooManySlides.slides[0]!,
      id: `bounded-slide-${index}`,
      order: index,
    }));
    expect(parseDeckSpec(tooManySlides)).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: "too_many_slides" })]),
    });

    const tooMuchText = validDeck();
    tooMuchText.slides[0]!.contentBlocks = [{ type: "paragraph", text: "x".repeat(MAX_DECK_TEXT_CHARACTERS + 1) }];
    expect(parseDeckSpec(tooMuchText)).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: "deck_text_too_large" })]),
    });
  });
});
