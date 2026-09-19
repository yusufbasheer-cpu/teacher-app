import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import {
  hasSuspiciousEquationOperatorGap,
  validatePptContentSafety,
} from "./ppt-content-safety";
import { buildPptxFromTemplateEngine } from "./ppt-template-engine";
import type { StructuredLessonSlideModel } from "./ppt-structured-lesson";

function oneSlide(body: string): StructuredLessonSlideModel {
  return {
    slideTitle: "Main Phase Core Teaching",
    body,
    speakerNotes: "",
    includeImageSlot: false,
  };
}

describe("PPT content safety", () => {
  it("flags suspicious equation blanks without hardcoding one example", () => {
    expect(hasSuspiciousEquationOperatorGap("Solve 7y __ 4 = 24")).toBe(true);
    expect(hasSuspiciousEquationOperatorGap("Solve 7y - 4 = 24")).toBe(false);
  });

  it("flags truncation and incomplete trailing sentences", () => {
    const warnings = validatePptContentSafety([
      oneSlide("Students solve the first equation..."),
      oneSlide("Now explain the inverse operation because"),
    ]);

    expect(warnings.map((w) => w.kind)).toEqual(
      expect.arrayContaining(["incomplete-sentence"]),
    );
  });

  it("preserves mathematical operators in rendered PPT XML", async () => {
    const buf = await buildPptxFromTemplateEngine({
      templateId: "classic",
      slides: [
        oneSlide("5x - 8 = 3x + 2(x - 4)\n6x + 5 = 2x + 15\nx >= 4 and y <= 10"),
      ],
      subject: "Math",
      grade: "Grade 8",
      topic: "Solving Linear Equations",
      language: "en",
    });
    const zip = await JSZip.loadAsync(buf);
    const xml = (
      await Promise.all(
        Object.keys(zip.files)
          .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
          .map((n) => zip.file(n)!.async("string")),
      )
    ).join("\n");

    expect(xml).toContain("5x - 8 = 3x + 2(x - 4)");
    expect(xml).toContain("6x + 5 = 2x + 15");
    expect(xml).toContain("x &gt;= 4 and y &lt;= 10");
  });

  it("logs warnings during rendering without mutating the deck", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const deck = [oneSlide("Solve 3a __ 9 = 18")];

    await buildPptxFromTemplateEngine({
      templateId: "classic",
      slides: deck,
      subject: "Math",
      grade: "Grade 8",
      topic: "Linear Equations",
    });

    expect(warn).toHaveBeenCalledWith(
      "[pptx render] content safety warnings:",
      expect.stringContaining("suspicious-equation"),
    );
    expect(deck[0]!.body).toBe("Solve 3a __ 9 = 18");
    warn.mockRestore();
  });
});
