import { describe, expect, it } from "vitest";
import { computeDeckQualityReport } from "./ppt-quality-report";
import { buildStructuredLessonSlides } from "./ppt-structured-lesson";

describe("deck quality diagnostic", () => {
  it("flags generic fallback fixture language without blocking rendering", () => {
    const slides = buildStructuredLessonSlides({
      subject: "Science",
      grade: "Year 7",
      topic: "The Water Cycle",
      teacherName: "Quality Review",
      learningObjectivesText: "Explain evaporation and condensation.",
    });
    const report = computeDeckQualityReport(slides);
    expect(report.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("generic starter prompt"),
      expect.stringContaining("unexplained SDG connection"),
      expect.stringContaining("core teaching placeholder"),
      expect.stringContaining("missing exit-ticket question"),
    ]));
    expect(report.content_quality).toBeLessThan(100);
  });
});
