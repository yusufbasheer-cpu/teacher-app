import { describe, expect, it } from "vitest";
import { normalizeExtendedTaskSlide, validateSlide10ExtendedBody } from "./ppt-slide-by-slide";
import { buildCanonicalSlides } from "./gamma/payload";
import { makeDeck } from "./gamma/test-helpers";

describe("Extended Task one-slide contract", () => {
  it("shortens an oversized real-life task to the required student format", () => {
    const normalized = normalizeExtendedTaskSlide([
      "Task name: Five-Day Photosynthesis Investigation at Home",
      "Your mission: Observe how access to sunlight changes one plant and explain what your evidence suggests about photosynthesis over several days.",
      "1. Choose one safe leafy plant at home or school that you can observe without moving it.",
      "2. Record the leaf colour and position once each day for five days in your notebook.",
      "3. Compare what you notice with a leaf that receives less sunlight nearby.",
      "4. Explain how your observations connect sunlight to food-making in plants using evidence.",
      "5. Buy a specialist light meter and collect several different products.",
      "Expected output: A long report, a poster, a model, and a presentation for the whole class next week.",
      "Skill you'll build: observing and recording data clearly",
      "Challenge: Compare one extra leaf and explain one difference using evidence from your observations.",
      "Teacher guidance: Look for one accurate link between sunlight and food-making.",
      "How this connects to future learning: students will study ecosystems next term.",
    ].join("\n"), "Photosynthesis");

    expect(normalized.slideTitle.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(normalized.body).toContain("Your mission:");
    expect(normalized.body).toContain("Show us:");
    expect(normalized.body).toContain("Skill you'll build:");
    expect(normalized.body).not.toMatch(/future learning|Teacher guidance|5\./i);
    expect(normalized.teacherGuidance.join(" ")).toMatch(/Teacher guidance|future learning/i);
    expect(validateSlide10ExtendedBody(normalized.body, normalized.slideTitle)).toEqual({ ok: true, reasons: [] });
  });

  it("creates one Gamma card for the Extended Task and leaves other overflow unchanged", () => {
    const deck = makeDeck();
    deck[8] = { ...deck[8]!, body: Array.from({ length: 35 }, (_, i) => `Plenary prompt ${i + 1} with enough words to require continuation.`).join("\n") };
    deck[9] = { ...deck[9]!, body: normalizeExtendedTaskSlide("1. Observe one example.\n2. Record one detail.\n3. Explain what it shows.", "Patterns").body };
    const slides = buildCanonicalSlides({ deck });
    expect(slides.filter((slide) => slide.deckIdx === 8).length).toBeGreaterThan(1);
    expect(slides.filter((slide) => slide.deckIdx === 9)).toHaveLength(1);
  });
});
