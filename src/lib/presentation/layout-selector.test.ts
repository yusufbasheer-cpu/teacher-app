import { describe, expect, it } from "vitest";
import { selectLearningObjectiveLayout } from "@/lib/presentation/layout-selector";

const shortContent = { objective: "Explain how evaporation changes liquid water into water vapour." };

describe("deterministic presentation layout selector", () => {
  it("is stable for the same lesson, slide and unchanged content", () => {
    const input = { enabled: true, lessonId: "lesson-stable", slideId: "slide-4", content: shortContent };
    const selections = Array.from({ length: 10 }, () => selectLearningObjectiveLayout(input));
    expect(new Set(selections.map((selection) => selection.kind === "registered" ? selection.layout.id : selection.reason)).size).toBe(1);
  });

  it("uses the lesson seed to vary between eligible layouts", () => {
    const selected = new Set<string>();
    for (let index = 0; index < 100; index += 1) {
      const result = selectLearningObjectiveLayout({ enabled: true, lessonId: `lesson-${index}`, slideId: "slide-4", content: shortContent });
      if (result.kind === "registered") selected.add(result.layout.id);
    }
    expect(selected).toEqual(new Set(["lo_statement_01", "lo_target_01"]));
  });

  it("filters incompatible layouts before selecting", () => {
    const content = { objective: "x".repeat(200) };
    const result = selectLearningObjectiveLayout({ enabled: true, lessonId: "lesson-long", slideId: "slide-4", content });
    expect(result.kind).toBe("registered");
    if (result.kind === "registered") {
      expect(result.layout.id).toBe("lo_statement_01");
      expect(result.eligibleLayoutIds).toEqual(["lo_statement_01"]);
    }
  });

  it("uses the legacy renderer when disabled or when no layout fits", () => {
    expect(selectLearningObjectiveLayout({ enabled: false, lessonId: "lesson", slideId: "slide-4", content: shortContent })).toMatchObject({ kind: "legacy", reason: "feature-disabled" });
    const oversized = selectLearningObjectiveLayout({ enabled: true, lessonId: "lesson", slideId: "slide-4", content: { objective: "x".repeat(281) } });
    expect(oversized).toMatchObject({ kind: "legacy", reason: "no-compatible-layout" });
    if (oversized.kind === "legacy") {
      expect(oversized.validationFailures).toMatchObject({
        lo_statement_01: expect.arrayContaining(["character_limit_exceeded:objective"]),
        lo_target_01: expect.arrayContaining(["character_limit_exceeded:objective"]),
      });
    }
  });

  it("honours compatible internal overrides and rejects incompatible ones", () => {
    expect(selectLearningObjectiveLayout({ enabled: true, lessonId: "lesson", slideId: "slide-4", content: shortContent, requestedLayoutId: "lo_target_01" })).toMatchObject({ kind: "registered", layout: { id: "lo_target_01" } });
    expect(selectLearningObjectiveLayout({ enabled: true, lessonId: "lesson", slideId: "slide-4", content: { objective: "x".repeat(200) }, requestedLayoutId: "lo_target_01" })).toMatchObject({ kind: "legacy", reason: "requested-layout-incompatible" });
  });

  it("avoids the previous family when another compatible family exists", () => {
    expect(selectLearningObjectiveLayout({ enabled: true, lessonId: "lesson", slideId: "slide-4", content: shortContent, previousFamily: "statement" })).toMatchObject({ kind: "registered", layout: { family: "target" } });
  });
});
