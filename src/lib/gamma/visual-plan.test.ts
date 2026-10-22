import { describe, expect, it } from "vitest";
import { planGammaVisuals, visualInstructionsFor } from "./visual-plan";
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
