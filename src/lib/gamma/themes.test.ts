import { describe, expect, it } from "vitest";
import { curateGammaThemes, validateGammaPresentationOptions, type GammaTheme } from "./themes";

const themes: GammaTheme[] = [
  { id: "clean", name: "Boardroom", type: "standard", colorKeywords: ["blue"], toneKeywords: ["professional", "clean"] },
  { id: "fresh", name: "Notebook", type: "standard", colorKeywords: ["green"], toneKeywords: ["modern", "educational"] },
  { id: "bold", name: "Pop", type: "standard", colorKeywords: ["colorful"], toneKeywords: ["vibrant", "playful"] },
];

describe("Gamma theme presentation", () => {
  it("curates three distinct themes against the documented keyword metadata", () => {
    const result = curateGammaThemes(themes);
    expect(result.map((t) => t.id)).toEqual(["clean", "fresh", "bold"]);
    expect(new Set(result.map((t) => t.id)).size).toBe(3);
  });
  it("accepts only server-listed themes and truthful image options", () => {
    expect(validateGammaPresentationOptions({ themeId: "fresh", imageSource: "pexels", imageStyle: "ignored" }, themes)).toEqual({ themeId: "fresh", imageSource: "pexels", imageStyle: undefined });
    expect(() => validateGammaPresentationOptions({ themeId: "not-real" }, themes)).toThrow(/not available/);
  });
});
