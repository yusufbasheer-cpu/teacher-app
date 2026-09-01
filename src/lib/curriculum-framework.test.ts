import { describe, expect, it } from "vitest";
import {
  CURRICULUM_FRAMEWORK_OPTIONS,
  buildCurriculumFrameworkSystemAddendum,
} from "./curriculum-framework";

const NON_EMPTY_FRAMEWORK_VALUES = CURRICULUM_FRAMEWORK_OPTIONS.map((o) => o.value).filter(
  (v) => v !== "",
);

const NARRATION_PHRASES = [
  "this aligns with",
  "this meets",
  "according to",
  "this supports curriculum standards",
];

describe("buildCurriculumFrameworkSystemAddendum", () => {
  it("CASE A — omitted curriculum injects no framework addendum", () => {
    expect(buildCurriculumFrameworkSystemAddendum("")).toBeNull();
    expect(buildCurriculumFrameworkSystemAddendum("   ")).toBeNull();
  });

  it("CASE B — a selected framework produces non-empty guidance for every known option", () => {
    for (const value of NON_EMPTY_FRAMEWORK_VALUES) {
      const addendum = buildCurriculumFrameworkSystemAddendum(value);
      expect(addendum, value).toBeTruthy();
      expect(addendum!.length).toBeGreaterThan(20);
    }
  });

  it("an unrecognized framework value produces no addendum (fails closed, not open)", () => {
    expect(buildCurriculumFrameworkSystemAddendum("made_up_framework")).toBeNull();
  });

  it("CASE D — every framework addendum instructs silent application, not narrated compliance claims", () => {
    for (const value of NON_EMPTY_FRAMEWORK_VALUES) {
      const addendum = buildCurriculumFrameworkSystemAddendum(value)!;
      const lower = addendum.toLowerCase();
      // Must instruct the model not to narrate alignment in ordinary sections,
      // and the forbidden-phrase examples must appear only inside that one
      // prohibition sentence, not as a separate directive elsewhere.
      const guidanceIdx = lower.indexOf("do not insert explicit statements such as");
      expect(guidanceIdx, value).toBeGreaterThanOrEqual(0);
      const guidanceSentenceEnd = lower.indexOf("formally verifies", guidanceIdx);
      expect(guidanceSentenceEnd, value).toBeGreaterThan(guidanceIdx);
      for (const phrase of NARRATION_PHRASES) {
        const occurrences = [...lower.matchAll(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))];
        for (const match of occurrences) {
          expect(
            match.index! > guidanceIdx && match.index! < guidanceSentenceEnd,
            `"${phrase}" in ${value} must only appear inside the prohibition sentence`,
          ).toBe(true);
        }
      }
    }
  });

  it("reserves explicit alignment narration for a section that deliberately owns it (e.g. UAE)", () => {
    const uae = buildCurriculumFrameworkSystemAddendum("uae_moe_khda_spea")!;
    expect(uae.toLowerCase()).toContain(
      "dedicated real-life/curriculum-connection slide".toLowerCase(),
    );
  });
});
