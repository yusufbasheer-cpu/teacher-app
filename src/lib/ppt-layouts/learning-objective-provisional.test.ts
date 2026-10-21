import { describe, expect, it } from "vitest";
import { learningObjectiveFits, validateLearningObjectiveLayout } from "@/lib/ppt-layouts/learning-objective-layout";
import {
  PROVISIONAL_LEARNING_OBJECTIVE_LAYOUTS,
  STATEMENT_LAYOUT,
  TARGET_LAYOUT,
} from "@/lib/ppt-layouts/learning-objective-provisional";

describe("provisional learning-objective layouts", () => {
  it("defines two valid, code-rendered 16:9 layouts", () => {
    expect(PROVISIONAL_LEARNING_OBJECTIVE_LAYOUTS.map((layout) => layout.id)).toEqual(["lo_statement_01", "lo_target_01"]);
    for (const layout of PROVISIONAL_LEARNING_OBJECTIVE_LAYOUTS) {
      expect(validateLearningObjectiveLayout(layout)).toEqual([]);
      expect(layout.backgroundAsset).toBeNull();
    }
  });
  it("fits short objectives in both layouts and longer objectives in Statement only", () => {
    const short = { objective: "Explain how evaporation changes liquid water into water vapour." };
    const long = { objective: "Compare evaporation and condensation, explain how particle movement changes during each process, and use evidence from a classroom investigation to justify where both changes occur in the water cycle." };
    expect(learningObjectiveFits(TARGET_LAYOUT, short)).toBe(true);
    expect(learningObjectiveFits(STATEMENT_LAYOUT, short)).toBe(true);
    expect(learningObjectiveFits(TARGET_LAYOUT, long)).toBe(false);
    expect(learningObjectiveFits(STATEMENT_LAYOUT, long)).toBe(true);
  });
});
