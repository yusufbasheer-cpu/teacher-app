import { describe, expect, it } from "vitest";
import { SLIDE_BODY_LIMIT, dropRepeatedTail, mergeBodies } from "./ppt-structured-lesson";

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

describe("mergeBodies — overlapping extractions of the same source collapse instead of repeating", () => {
  // Regression: pickUaeFrameworkSlide8 extracts two windows from the same slide-8 source text
  // (one starting at the first "uae" match, one starting at the first "cross curricular"
  // match) via a fixed-width slice with no end boundary. On a short source both windows run to
  // the end of the string, so the later-starting one ends up a literal suffix of the earlier
  // one — a real UAE-framework generation showed this as the deck's whole 4-part UAE section
  // repeating a second time, cut off mid-sentence.
  const wholeText =
    "UAE Real-Life Connection: paragraph one here. Cross-Curricular Link: paragraph two here. UAE MOE Alignment: paragraph three here.";
  const suffixFromCrossOnward =
    "Cross-Curricular Link: paragraph two here. UAE MOE Alignment: paragraph three here.";

  it("drops a secondary extraction that is fully contained in the primary one", () => {
    expect(mergeBodies(wholeText, suffixFromCrossOnward, "")).toBe(wholeText);
  });

  it("drops a primary extraction that is fully contained in a longer secondary one", () => {
    expect(mergeBodies(suffixFromCrossOnward, wholeText, "")).toBe(wholeText);
  });

  it("still concatenates two genuinely different, non-overlapping bodies", () => {
    const result = mergeBodies("First distinct paragraph.", "Second, unrelated paragraph.", "");
    expect(result).toContain("First distinct paragraph.");
    expect(result).toContain("Second, unrelated paragraph.");
  });

  it("returns the one non-empty side unchanged when the other is blank", () => {
    expect(mergeBodies("Only content here.", "", "")).toBe("Only content here.");
    expect(mergeBodies("", "Only content here.", "")).toBe("Only content here.");
  });
});

describe("dropRepeatedTail — cuts a body off where it starts repeating itself", () => {
  it("removes a substantial repeated chunk near the end", () => {
    const original =
      "Students reflect on today's lesson and summarise the key procedures they practised, " +
      "noting what stood out and what they still need to work on before the next class.";
    const withRepeatedTail = `${original} Teacher Instructions: Collect the reflection cards as students leave the room.${original}`;
    expect(dropRepeatedTail(withRepeatedTail)).toBe(
      `${original} Teacher Instructions: Collect the reflection cards as students leave the room.`,
    );
  });

  it("leaves genuinely non-repeating content untouched", () => {
    const text =
      "Solve the quadratic equation by factorisation, then verify your answer using the quadratic formula and compare the two results.";
    expect(dropRepeatedTail(text)).toBe(text);
  });

  it("does not false-positive on short recurring domain phrases", () => {
    const text =
      "A quadratic equation has a discriminant. The discriminant of a quadratic equation tells you the nature of its roots, " +
      "and every quadratic equation can be solved once the discriminant is known.";
    expect(dropRepeatedTail(text)).toBe(text);
  });
});
