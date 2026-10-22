import { describe, expect, it } from "vitest";
import { buildGammaPayload, GAMMA_CARD_BREAK } from "./payload";
import { makeDeck, testConfig } from "./test-helpers";

describe("request serialisation", () => {
  const config = testConfig();
  it("builds a preserve / inputTextBreaks request with one card per slide", () => {
    const { request, snapshot } = buildGammaPayload({ deck: makeDeck(), title: "G7 Maths", language: "en", config });
    expect(request).toMatchObject({ textMode: "preserve", format: "presentation", cardSplit: "inputTextBreaks", exportAs: "pptx", cardOptions: { dimensions: "16x9" } });
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
