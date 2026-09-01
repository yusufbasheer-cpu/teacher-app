import { describe, expect, it } from "vitest";
import { SLIDE_BODY_LIMIT } from "./ppt-structured-lesson";

describe("SLIDE_BODY_LIMIT — per-slide truncation ceilings", () => {
  it("gives slide index 7 (UAE / Real-Life Connection) enough room for its 4-part content", () => {
    // Regression: this slide's UAE-framework body is 4 sub-sections (real-life connection,
    // cross-curricular link, MOE alignment, SDG context) — a real generation measured
    // ~2,900-3,100 characters for it. The cap used to be 1,600, silently cutting the deck's
    // last two sub-sections with a mid-sentence ellipsis. It must stay comfortably above
    // what real content needs, not just above the old broken value.
    const uaeSlideLimit = SLIDE_BODY_LIMIT[7]!;
    expect(uaeSlideLimit.chars).toBeGreaterThanOrEqual(4000);
    expect(uaeSlideLimit.lines).toBeGreaterThanOrEqual(20);
  });

  it("no longer leaves slide 7 as a cramped outlier next to its similarly rich siblings", () => {
    // Indices 1 (Starter Activity), 6 (Differentiated Activity), and 8 (Plenary) are the
    // deck's other AFL-heavy, multi-part slides. Slide 7 used to be capped at roughly half
    // their size despite carrying just as much (or more) content in UAE mode — it should now
    // be at least as generous as those siblings, not the deck's tightest AFL-heavy slide.
    const siblingChars = [1, 6, 8].map((i) => SLIDE_BODY_LIMIT[i]!.chars);
    expect(SLIDE_BODY_LIMIT[7]!.chars).toBeGreaterThanOrEqual(Math.max(...siblingChars));
  });
});
