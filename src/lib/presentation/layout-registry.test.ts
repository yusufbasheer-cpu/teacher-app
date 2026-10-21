import { describe, expect, it } from "vitest";
import { DESIGN_LIBRARY_SLIDE_TYPES, LAYOUT_REGISTRY, getRegisteredLayout, getRegisteredLayoutsForSlideType } from "@/lib/presentation/layout-registry";
import { validateLayoutRegistry } from "@/lib/presentation/quality-checks";

describe("presentation layout registry", () => {
  it("registers the two approved learning-objective layouts", () => {
    expect(validateLayoutRegistry(LAYOUT_REGISTRY)).toEqual([]);
    expect(DESIGN_LIBRARY_SLIDE_TYPES).toHaveLength(13);
    expect(getRegisteredLayoutsForSlideType("learning-objective").map((layout) => layout.id)).toEqual(["lo_statement_01", "lo_target_01"]);
  });

  it("stores content limits, fit validation and render functions with each definition", () => {
    for (const id of ["lo_statement_01", "lo_target_01"] as const) {
      const layout = getRegisteredLayout(id)!;
      expect(layout.contentLimits.slots.map((slot) => slot.name)).toContain("objective");
      expect(layout.fits({ objective: "Explain evaporation." })).toBe(true);
      expect(layout.render).toBeTypeOf("function");
    }
  });

  it("registers exactly the provisional Phase 4A title and starter layouts", () => {
    expect(getRegisteredLayoutsForSlideType("title").map((layout) => layout.id)).toEqual(["title_hero_01", "title_typography_01"]);
    expect(getRegisteredLayoutsForSlideType("starter").map((layout) => layout.id)).toEqual(["starter_activity_brief_01", "starter_visual_prompt_01"]);
    expect(new Set(LAYOUT_REGISTRY.map((layout) => layout.slideType))).toEqual(new Set(["learning-objective", "title", "starter"]));
  });
});
