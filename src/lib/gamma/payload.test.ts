import { describe, expect, it } from "vitest";
import { buildGammaPayload, GAMMA_CARD_BREAK } from "./payload";
import { makeDeck, testConfig } from "./test-helpers";

describe("request serialisation", () => {
  const config = testConfig();
  it("leads the cover with the lesson topic and pitches the text at the class", () => {
    const deck = makeDeck();
    deck[0] = { ...deck[0]!, slideTitle: "Science, Grade 1", body: "Grade 1\nThursday, 22 October 2026" };
    const { request, snapshot } = buildGammaPayload({ deck, title: "t", language: "en", config, lesson: { topic: "Reflection of Light", subject: "Science", grade: "Grade 1", chapter: "Light" } });
    expect(snapshot[0]!.title).toBe("Reflection of Light");
    expect(String(request.inputText).split(GAMMA_CARD_BREAK)[0]).toBe("# Reflection of Light\n\nScience · Grade 1\nLight\nThursday, 22 October 2026");
    expect(request.textOptions).toMatchObject({ amount: "detailed", audience: "Grade 1 Science students and their teacher", language: "en" });
  });
  it("asks for an image on every image-slot slide, whatever the topic", () => {
    const deck = makeDeck(3).map((s) => ({ ...s, includeImageSlot: true }));
    const { visualBriefs, request } = buildGammaPayload({ deck, title: "t", language: "en", config, lesson: { topic: "Reflection of Light", subject: "Science", grade: "Grade 1" } });
    expect(visualBriefs.every((b) => b.needsImage)).toBe(true);
    expect(String(request.additionalInstructions)).not.toContain("No slide requires an image");
  });
  it("builds a condense / inputTextBreaks request with one card per slide", () => {
    const { request, snapshot } = buildGammaPayload({ deck: makeDeck(), title: "G7 Maths", language: "en", config });
    expect(request).toMatchObject({ textMode: "condense", format: "presentation", cardSplit: "inputTextBreaks", exportAs: "pptx", cardOptions: { dimensions: "16x9" } });
    expect(request).not.toHaveProperty("numCards");
    expect(String(request.inputText).split(GAMMA_CARD_BREAK)).toHaveLength(13);
    expect(snapshot).toHaveLength(13);
    expect(String(request.inputText)).not.toContain("notes that must not be sent");
    expect(String(request.additionalInstructions).length).toBeLessThanOrEqual(5000);
    expect(JSON.stringify(request)).not.toContain("test-key-123");
  });
  it("neutralises stray --- lines so they cannot create extra cards", () => {
    const deck = makeDeck();
    deck[2] = { ...deck[2], body: "before\n---\nafter" };
    const { request, neutralisedBreaks } = buildGammaPayload({ deck, title: "t", language: "en", config });
    expect(neutralisedBreaks).toBe(1);
    expect(String(request.inputText).split(GAMMA_CARD_BREAK)).toHaveLength(13);
  });
  it("only sends image model/style for aiGenerated", () => {
    const withModel = { ...config, imageModel: "m1", imageStyle: "flat" };
    expect(buildGammaPayload({ deck: makeDeck(2), title: "t", language: "en", config: withModel }).request.imageOptions).toEqual({ source: "aiGenerated", model: "m1", style: "flat" });
    expect(buildGammaPayload({ deck: makeDeck(2), title: "t", language: "en", config: { ...withModel, imageSource: "noImages" } }).request.imageOptions).toEqual({ source: "noImages" });
  });
});

describe("design brief size", () => {
  it("fits Gamma's 5000-char limit without being cut, even with long titles on all 13 slides", () => {
    const deck = makeDeck().map((s, i) => ({ ...s, slideTitle: `Differentiated Activity and Mini Plenary ${i}`, body: "x", includeImageSlot: true }));
    const { request } = buildGammaPayload({ deck, title: "t", language: "en", config: testConfig(), lesson: { topic: "Reflection of Light and Formation of Images", subject: "Science", grade: "Grade 1" } });
    const brief = String(request.additionalInstructions);
    expect(brief.length).toBeLessThan(4900);
    expect(brief.endsWith("shrink text to fit.")).toBe(true);
  });
});
