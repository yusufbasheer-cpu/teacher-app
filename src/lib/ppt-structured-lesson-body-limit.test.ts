import { describe, expect, it } from "vitest";
import { SLIDE_BODY_LIMIT, dropRepeatedTail, mergeBodies } from "./ppt-structured-lesson";

// The deck's AFL-heavy, multi-part slides — Starter Activity, Differentiated Activity, UAE /
// Real-Life Connection, Plenary, Extended Task. Two of these (7, then 9) were independently
// found undersized relative to their siblings and each silently truncated a real generation
// mid-sentence — kept as one list so a future regression on any sibling fails the same way.
const AFL_HEAVY_RICH_SLIDE_INDICES = [1, 6, 7, 8, 9] as const;

describe("SLIDE_BODY_LIMIT — per-slide truncation ceilings", () => {
  it.each([
    [7, "UAE / Real-Life Connection", "its 4-part UAE-mode content (real-life connection, cross-curricular link, MOE alignment, SDG context)"],
    [9, "Extended Task", "an elaborate multi-step design task with a diagram requirement and a future-learning section"],
  ])("gives slide index %i (%s) enough room for %s", (index) => {
    // Regression: both of these were independently capped well below what a real generation
    // needed and got cut off mid-sentence with a trailing ellipsis as a result.
    const limit = SLIDE_BODY_LIMIT[index]!;
    expect(limit.chars).toBeGreaterThanOrEqual(3400);
    expect(limit.lines).toBeGreaterThanOrEqual(20);
  });

  it("keeps every AFL-heavy rich slide within reach of its siblings — no cramped outlier", () => {
    // A slide capped at roughly half what its siblings get is exactly the shape both prior
    // bugs took. Every slide in this group should sit within 2x of the smallest of the group,
    // not fall arbitrarily further behind.
    const chars = AFL_HEAVY_RICH_SLIDE_INDICES.map((i) => SLIDE_BODY_LIMIT[i]!.chars);
    const min = Math.min(...chars);
    const max = Math.max(...chars);
    expect(max).toBeLessThanOrEqual(min * 2);
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
