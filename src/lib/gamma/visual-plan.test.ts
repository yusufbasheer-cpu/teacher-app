import { describe, expect, it } from "vitest";
import { classifySlide, layoutInstructionsFor, pictureMediumFor, planSlideLayouts, type CanonicalSlide } from "./visual-plan";

const slide = (deckIdx: number, lines: string[], part = 1, title = `Slide ${deckIdx + 1}`): CanonicalSlide => ({ deckIdx, part, parts: part, title, lines });

describe("slide types", () => {
  it("classifies by lesson role and content", () => {
    expect(classifySlide(slide(0, ["Science · Grade 8"]))).toBe("title");
    expect(classifySlide(slide(3, ["Explain force"]))).toBe("objectives");
    expect(classifySlide(slide(10, ["What is pressure?", "Explain why."]))).toBe("questions");
    expect(classifySlide(slide(6, ["A box weighs 60 N on 0.3 m². Calculate the pressure."]))).toBe("worked-example");
    expect(classifySlide(slide(7, ["Dentists use mirrors."]))).toBe("real-life");
    expect(classifySlide(slide(1, ["Observe the pin."]))).toBe("activity");
    expect(classifySlide(slide(2, ["Chapter: Force"]))).toBe("concept");
    expect(classifySlide(slide(12, ["Think back"]))).toBe("summary");
  });
});

describe("image policy: concept diagrams first, content always first", () => {
  it("puts a concept diagram on core teaching, and no cover art or decorative chapter picture", () => {
    const plans = planSlideLayouts([
      slide(0, ["cover"]),
      slide(2, ["Chapter: Force and Pressure"]),
      slide(5, ["Pressure = force ÷ area. ".repeat(30)]),
      slide(7, ["Dentists use mirrors."]),
    ]);
    expect(plans.map((p) => p.image)).toEqual(["none", "none", "diagram", "side"]);
  });
  it("gives continuation, question, worked-example, objective and dense slides no picture", () => {
    const plans = planSlideLayouts([
      slide(5, ["x".repeat(1300)]),
      slide(7, ["Dentists use mirrors."], 2),
      slide(10, ["What is pressure?"]),
      slide(6, ["Calculate 60 ÷ 0.3"]),
      slide(4, ["Outcome"]),
      slide(7, ["y".repeat(800)]),
    ]);
    expect(plans.map((p) => p.image)).toEqual(["none", "none", "none", "none", "none", "none"]);
  });
  it("keeps short activities to a small inset", () => {
    expect(planSlideLayouts([slide(1, ["Observe a sharp and a blunt pin."])])[0]!.image).toBe("inset");
  });
});

describe("picture choice", () => {
  it("maps Gamma image settings to the teacher's choice", () => {
    expect(pictureMediumFor("aiGenerated", "clean educational illustration")).toBe("illustration");
    expect(pictureMediumFor("aiGenerated", "photorealistic, natural lighting")).toBe("realistic");
    expect(pictureMediumFor("pexels")).toBe("photo");
    expect(pictureMediumFor("noImages")).toBe("none");
  });
  it("describes the chosen medium and says 'no image' where none is planned", () => {
    const slides = [slide(0, ["cover"]), slide(5, ["Pressure is force per unit area."], 1, "Main Phase Core Teaching"), slide(10, ["Why?"])];
    const plans = planSlideLayouts(slides);
    expect(layoutInstructionsFor(slides, plans, "photo")).toContain('one real photograph that shows the idea explaining "Main Phase Core Teaching"');
    expect(layoutInstructionsFor(slides, plans, "illustration")).toContain("simple concept diagram with no words or numbers in it");
    expect(layoutInstructionsFor(slides, plans, "illustration")).toContain("S1 title: no image.");
    expect(layoutInstructionsFor(slides, plans, "illustration")).toContain("S3 questions: no image.");
    expect(layoutInstructionsFor(slides, plans, "none")).not.toMatch(/photograph|illustration or/);
  });
});
