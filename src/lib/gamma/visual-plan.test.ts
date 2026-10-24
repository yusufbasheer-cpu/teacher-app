import { describe, expect, it } from "vitest";
import { classifySlide, layoutInstructionsFor, pictureMediumFor, planSlideLayouts, targetMeaningfulImageCount, type CanonicalSlide } from "./visual-plan";

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

describe("image policy: six required educational categories, content always first", () => {
  it("targets seven meaningful visuals for 20 slides and eight for 24", () => {
    expect(targetMeaningfulImageCount(20)).toBe(7);
    expect(targetMeaningfulImageCount(24)).toBe(8);
  });
  it("adds distinct eligible continuation visuals to meet the ratio on a 20-slide deck", () => {
    const slides = Array.from({ length: 20 }, (_, index) => ({
      ...slide(index === 0 ? 0 : index < 8 ? 5 : index < 14 ? 8 : 9, [`Teaching evidence ${index + 1}`], index === 0 ? 1 : (index % 4) + 1),
      parts: 4,
    }));
    expect(planSlideLayouts(slides).filter((plan) => plan.image !== "none")).toHaveLength(7);
  });
  it("a 24-slide brief with long slide text fits the budget and never loses its rules", () => {
    const long = "Pressure is force spread over an area; sharper blades cut more easily because the area is smaller. ".repeat(4);
    const slides = Array.from({ length: 24 }, (_, i) => ({ ...slide(i === 0 ? 0 : i < 10 ? 5 : i < 18 ? 8 : 9, [long, long], i === 0 ? 1 : (i % 4) + 1), parts: 4 }));
    const plans = planSlideLayouts(slides);
    const text = layoutInstructionsFor(slides, plans, "illustration", { subject: "Science", grade: "8", topic: "Force and Pressure" }, 3200);
    expect(text.length).toBeLessThanOrEqual(3200);
    expect(text).toContain("Match the requested medium exactly");
    expect(text).toContain(`Create exactly ${plans.filter((p) => p.image !== "none").length} meaningful images`);
    expect(text).toMatch(/S24 /);
  });
  it("plans required cover, topic, main-phase, and real-life visuals", () => {
    const plans = planSlideLayouts([
      slide(0, ["cover"]),
      slide(2, ["Chapter: Force and Pressure"]),
      slide(5, ["Pressure = force ÷ area. ".repeat(30)]),
      slide(7, ["Dentists use mirrors."]),
    ]);
    expect(plans.map((p) => p.image)).toEqual(["side", "diagram", "diagram", "side"]);
  });
  it("keeps continuation, question, worked-example and objective slides text-only while allowing a moderate real-life visual", () => {
    const plans = planSlideLayouts([
      slide(5, ["x".repeat(1300)]),
      slide(7, ["Dentists use mirrors."], 2),
      slide(10, ["What is pressure?"]),
      slide(6, ["Calculate 60 ÷ 0.3"]),
      slide(4, ["Outcome"]),
      slide(7, ["y".repeat(800)]),
    ]);
    expect(plans.map((p) => p.image)).toEqual(["diagram", "none", "none", "none", "none", "side"]);
  });
  it("keeps useful visuals on moderately detailed activity slides", () => {
    const plans = planSlideLayouts([
      slide(8, ["Students review the central idea. ".repeat(12)]),
      slide(9, ["Students observe and compare examples. ".repeat(12)]),
    ]);
    expect(plans.map((p) => p.image)).toEqual(["inset", "inset"]);
  });
  it("requires a starter visual but keeps activity-instruction cards text-only", () => {
    expect(planSlideLayouts([slide(1, ["Observe a sharp and a blunt pin."])])[0]!.image).toBe("side");
    expect(planSlideLayouts([{ ...slide(5, ["1. Join your group."]), physicalKind: "activity-instructions" }])[0]!.image).toBe("none");
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
    expect(layoutInstructionsFor(slides, plans, "photo")).toContain('one real photograph that shows the idea accurately explaining "Main Phase Core Teaching — Pressure is force per unit area."');
    expect(layoutInstructionsFor(slides, plans, "illustration")).toContain("simple concept diagram with no words or numbers in it");
    expect(layoutInstructionsFor(slides, plans, "illustration")).toContain("REQUIRED cover visual");
    expect(layoutInstructionsFor(slides, plans, "illustration")).toContain("S3 questions: no image.");
    expect(layoutInstructionsFor(slides, plans, "illustration")).toContain("Every planned image is required");
    expect(layoutInstructionsFor(slides, plans, "none")).not.toMatch(/photograph|illustration or/);
  });
});
