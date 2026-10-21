import { describe, expect, it } from "vitest";
import { buildRegisteredLayoutContentGuidance } from "@/lib/presentation/content-budgets";
import { getLearningObjectiveContentBudget } from "@/lib/presentation/layout-registry";

describe("registered layout content budgets", () => {
  it("derives prompt limits from the approved layout registry", () => {
    expect(getLearningObjectiveContentBudget()).toEqual({
      preferredMaximumCharacters: 140,
      absoluteRegisteredMaximumCharacters: 280,
    });
    const guidance = buildRegisteredLayoutContentGuidance();
    expect(guidance).toContain("up to 140 characters");
    expect(guidance).toContain("up to 280 characters");
    expect(guidance).toContain("preserve it");
    expect(guidance).toContain("Never choose, name, or recommend a slide layout");
  });
});
