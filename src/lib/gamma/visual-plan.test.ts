import { describe, expect, it } from "vitest";
import { pictureMediumFor, planGammaVisuals, visualInstructionsFor } from "./visual-plan";
import { makeDeck } from "./test-helpers";

describe("deterministic Gamma visual planning", () => {
  it("selects subject-specific visuals without changing slide content", () => {
    const deck = makeDeck(5);
    deck[0] = { ...deck[0], slideTitle: "Heat transfer by conduction", body: "Heat moves through a solid." };
    deck[1] = { ...deck[1], slideTitle: "Specific heat capacity", body: "Calculate Q = mcΔT using 12.5 J." };
    deck[2] = { ...deck[2], slideTitle: "Power generation", body: "A turbine drives a generator." };
    const before = JSON.stringify(deck);
    const plan = planGammaVisuals(deck);
    expect(JSON.stringify(deck)).toBe(before);
    expect(plan.slice(0, 3).map((p) => p.visualType)).toEqual(["concept-diagram", "worked-example", "process-flow"]);
  });

  it("handles empty and image-slot-disabled slides safely", () => {
    const deck = makeDeck(2);
    deck[0] = { ...deck[0], slideTitle: "", body: "", includeImageSlot: true };
    deck[1] = { ...deck[1], slideTitle: "Heat transfer", includeImageSlot: false };
    expect(planGammaVisuals(deck).every((p) => !p.needsImage)).toBe(true);
    expect(visualInstructionsFor(planGammaVisuals(deck))).toMatch(/text-first/);
  });

  it("requires relevant visuals and rejects decorative filler in its guidance", () => {
    const plan = planGammaVisuals([{ ...makeDeck(1)[0], slideTitle: "Urban heat islands", body: "City versus green space." }]);
    const instructions = visualInstructionsFor(plan);
    expect(instructions).toContain("comparison");
    expect(instructions).toContain("generic icons");
    expect(instructions).toContain("Do not invent data labels");
  });
});

describe("picture choice", () => {
  const plan = planGammaVisuals(makeDeck(2), { topic: "Reflection of Light", subject: "Science", grade: "Grade 1" });
  it("maps Gamma image settings to the teacher's choice", () => {
    expect(pictureMediumFor("aiGenerated", "clean educational illustration")).toBe("illustration");
    expect(pictureMediumFor("aiGenerated", "photorealistic, natural lighting")).toBe("realistic");
    expect(pictureMediumFor("pexels")).toBe("photo");
    expect(pictureMediumFor("noImages")).toBe("none");
  });
  it("describes the chosen kind of picture in the brief", () => {
    expect(visualInstructionsFor(plan, "photo")).toContain("a real photograph showing");
    expect(visualInstructionsFor(plan, "realistic")).toContain("a photorealistic image of");
    expect(visualInstructionsFor(plan, "illustration")).toContain("illustration of");
    expect(visualInstructionsFor(plan, "none")).toMatch(/No slide requires an image/);
  });
});

describe("content before pictures", () => {
  it("gives text-heavy slides no picture and keeps pictures small elsewhere", () => {
    const deck = makeDeck(3).map((s) => ({ ...s, includeImageSlot: true }));
    deck[1] = { ...deck[1]!, body: "x ".repeat(300) };
    const plan = planGammaVisuals(deck, { topic: "Light", subject: "Science", grade: "Grade 1" });
    expect(plan.map((p) => p.needsImage)).toEqual([true, false, true]);
    expect(visualInstructionsFor(plan)).toContain("small inset");
  });
});
