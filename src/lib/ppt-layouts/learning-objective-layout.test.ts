import { describe, expect, it, vi } from "vitest";
import { LAYAH_WIDESCREEN, learningObjectiveFits, resolveLearningObjectiveSlot, validateLearningObjectiveFit, validateLearningObjectiveLayout, type LearningObjectiveLayoutDefinition } from "@/lib/ppt-layouts/learning-objective-layout";

function fixture(overrides: Partial<LearningObjectiveLayoutDefinition> = {}): LearningObjectiveLayoutDefinition {
  return {
    id: "test-only-learning-objective-layout",
    slideType: "learning-objective",
    aspectRatio: 16 / 9,
    backgroundAsset: "assets/test-only-learning-objective.png",
    slots: [
      { name: "label", box: { x: 0.08, y: 0.12, width: 0.5, height: 0.1 }, required: false, maxCharacters: 40, maxLines: 1, minimumFontPoints: 17, fontFallbacks: ["Poppins", "Arial"] },
      { name: "objective", box: { x: 0.08, y: 0.28, width: 0.84, height: 0.5 }, required: true, maxCharacters: 140, maxLines: 4, minimumFontPoints: 24, fontFallbacks: ["Poppins", "Arial"] },
    ],
    render: vi.fn(),
    ...overrides,
  };
}

describe("learning-objective layout contract", () => {
  it("accepts a complete 16:9, named-slot definition", () => {
    expect(validateLearningObjectiveLayout(fixture())).toEqual([]);
  });

  it("rejects missing approved IDs, non-PNG backgrounds and out-of-canvas slots", () => {
    const value = fixture({ id: " ", backgroundAsset: "background.jpg", slots: [{ ...fixture().slots[1]!, box: { x: 0.8, y: 0.2, width: 0.3, height: 0.4 } }] });
    expect(validateLearningObjectiveLayout(value).map((issue) => issue.path)).toEqual(expect.arrayContaining(["id", "backgroundAsset", "slots[0].box"]));
  });

  it("accepts a native-shape background without a raster asset", () => {
    expect(validateLearningObjectiveLayout(fixture({ backgroundAsset: null }))).toEqual([]);
  });

  it("rejects text slots that overlap protected visual geometry", () => {
    const layout = fixture({ protectedRegions: [{ x: 0.5, y: 0.3, width: 0.2, height: 0.2 }] });
    expect(validateLearningObjectiveLayout(layout)).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringContaining("overlaps protected visual region") }),
    ]));
  });

  it("accepts short and boundary-length objectives but rejects overflow", () => {
    const layout = fixture();
    expect(learningObjectiveFits(layout, { objective: "Explain evaporation." })).toBe(true);
    expect(learningObjectiveFits(layout, { objective: "x".repeat(140) })).toBe(true);
    expect(learningObjectiveFits(layout, { objective: "x".repeat(141) })).toBe(false);
  });

  it("returns safe diagnostic codes without including lesson text", () => {
    const secret = `private-${"x".repeat(145)}`;
    const issues = validateLearningObjectiveFit(fixture(), { objective: secret });
    expect(issues.map((issue) => issue.code)).toContain("character_limit_exceeded");
    expect(JSON.stringify(issues)).not.toContain(secret);
  });

  it("scales normalized slots to the existing widescreen dimensions", () => {
    const resolved = resolveLearningObjectiveSlot({ x: 0.1, y: 0.2, width: 0.5, height: 0.4 }, { slideWidth: LAYAH_WIDESCREEN.width, slideHeight: LAYAH_WIDESCREEN.height });
    expect(resolved.x).toBeCloseTo(1.3333);
    expect(resolved.y).toBeCloseTo(1.5);
    expect(resolved.w).toBeCloseTo(6.6665);
    expect(resolved.h).toBeCloseTo(3);
  });
});
