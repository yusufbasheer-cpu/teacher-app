import { describe, expect, it } from "vitest";
import { buildGammaPayload, GAMMA_CARD_BREAK } from "./payload";
import { makeDeck, testConfig } from "./test-helpers";

describe("request serialisation", () => {
  const config = testConfig();
  it("builds a preserve / inputTextBreaks request with one card per canonical slide", () => {
    const { request, snapshot } = buildGammaPayload({ deck: makeDeck(), title: "G7 Maths", language: "en", config });
    expect(request).toMatchObject({ textMode: "preserve", format: "presentation", cardSplit: "inputTextBreaks", exportAs: "pptx", cardOptions: { dimensions: "16x9" }, textOptions: { language: "en" } });
    expect(request).not.toHaveProperty("numCards");
    expect(String(request.inputText).split(GAMMA_CARD_BREAK)).toHaveLength(13);
    expect(snapshot).toHaveLength(13);
    expect(String(request.inputText)).not.toContain("notes that must not be sent");
    expect(JSON.stringify(request)).not.toContain("test-key-123");
  });
  it("leads the cover with the lesson topic, like the platform cover", () => {
    const deck = makeDeck();
    deck[0] = { ...deck[0]!, slideTitle: "Science, Grade 1", body: "Grade 1\nThursday, 22 October 2026" };
    const { request, snapshot } = buildGammaPayload({ deck, title: "t", language: "en", config, lesson: { topic: "Reflection of Light", subject: "Science", grade: "Grade 1", chapter: "Light" } });
    expect(snapshot[0]!.title).toBe("Reflection of Light");
    expect(String(request.inputText).split(GAMMA_CARD_BREAK)[0]).toBe("# Reflection of Light\n\nScience · Grade 1\n\nLight\n\nThursday, 22 October 2026");
  });
  it("does not send the AFL callout, which the platform deck does not show either", () => {
    const deck = makeDeck();
    deck[6] = { ...deck[6]!, aflCallout: "Thumbs up if ready" };
    expect(String(buildGammaPayload({ deck, title: "t", language: "en", config }).request.inputText)).not.toContain("Thumbs up");
  });
  it("splits a long section into continuation slides exactly like the platform renderer", () => {
    const deck = makeDeck();
    deck[9] = { ...deck[9]!, body: Array.from({ length: 30 }, (_, i) => `Step ${i + 1}: a full sentence of homework instructions for the class.`).join("\n") };
    const { slides, snapshot } = buildGammaPayload({ deck, title: "t", language: "en", config });
    const parts = slides.filter((s) => s.deckIdx === 9);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.title === deck[9]!.slideTitle)).toBe(true);
    // Every line survives, in order, across the continuation slides.
    expect(parts.flatMap((p) => p.lines)).toEqual(deck[9]!.body.split("\n"));
    expect(snapshot).toHaveLength(slides.length);
  });
  it("neutralises stray --- lines so they cannot create extra cards", () => {
    const deck = makeDeck();
    deck[2] = { ...deck[2]!, body: "before\n---\nafter" };
    const { request } = buildGammaPayload({ deck, title: "t", language: "en", config });
    expect(String(request.inputText).split(GAMMA_CARD_BREAK)).toHaveLength(13);
  });
  it("only sends image model/style for aiGenerated", () => {
    const withModel = { ...config, imageModel: "m1", imageStyle: "flat" };
    expect(buildGammaPayload({ deck: makeDeck(2), title: "t", language: "en", config: withModel }).request.imageOptions).toEqual({ source: "aiGenerated", model: "m1", style: "flat" });
    expect(buildGammaPayload({ deck: makeDeck(2), title: "t", language: "en", config: { ...withModel, imageSource: "noImages" } }).request.imageOptions).toEqual({ source: "noImages" });
  });
  it("sends the selected Gamma theme as a top-level generation option", () => {
    const request = buildGammaPayload({ deck: makeDeck(2), title: "t", language: "en", config: { ...config, themeId: "classroom-theme-123" } }).request;
    expect(request.themeId).toBe("classroom-theme-123");
    expect(request.imageOptions).toMatchObject({ source: "aiGenerated" });
  });
  it("fails before generation when physical instructions push the deck above 25 cards", () => {
    const deck = makeDeck();
    deck[5] = {
      ...deck[5]!,
      mainPhaseActivities: Array.from({ length: 13 }, (_, index) => ({
        activityId: `activity-${index}`,
        activityName: `Activity ${index + 1}`,
        studentInstructions: ["Join your group.", "Read the task.", "Complete the task.", "Check your answer."],
        requiredMaterials: ["task card"],
        expectedOutput: "a checked response",
        teacherNotes: "Prepare groups, monitor progress, support learners, manage timing, signal transitions, and check understanding.",
        activityContent: `Complete activity ${index + 1}.`,
        parentElementId: "main-phase" as const,
      })),
    };
    expect(() => buildGammaPayload({ deck, title: "t", language: "en", config })).toThrow(/at most 25/i);
  });
});

describe("design brief size", () => {
  it("fits Gamma's 5000-char limit uncut, even at the 25-card run limit with long titles", () => {
    const deck = makeDeck().map((s, i) => ({
      ...s,
      slideTitle: `Differentiated Activity and Mini Plenary ${i}`,
      body: i >= 6 && i <= 9 ? Array.from({ length: 22 }, (_, k) => `Line ${k}: a long instruction sentence that fills most of the width.`).join("\n") : "x",
    }));
    const { request, slides } = buildGammaPayload({ deck, title: "t", language: "en", config: testConfig(), lesson: { topic: "Reflection of Light and Formation of Images", subject: "Science", grade: "Grade 1" } });
    expect(slides.length).toBeGreaterThanOrEqual(20);
    const brief = String(request.additionalInstructions);
    expect(brief.length).toBeLessThan(4900);
    expect(brief.endsWith("invented labels, numbers or claims.")).toBe(true);
  });
});
