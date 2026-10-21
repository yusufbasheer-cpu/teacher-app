import { describe, expect, it } from "vitest";
import { computeDeckQualityReport } from "./ppt-quality-report";
import { buildStructuredLessonSlides } from "./ppt-structured-lesson";

describe("deck quality diagnostic", () => {
  it("flags explicit incomplete fallback sections without blocking rendering", () => {
    const slides = buildStructuredLessonSlides({
      subject: "Science",
      grade: "Year 7",
      topic: "The Water Cycle",
      teacherName: "Quality Review",
      learningObjectivesText: "Explain evaporation and condensation.",
    });
    const report = computeDeckQualityReport(slides);
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("generic_placeholder"),
      expect.stringContaining("exit_ticket_question_count"),
      expect.stringContaining("success_criteria_structure"),
    ]));
    expect(report.content_quality).toBeLessThan(100);
    expect(report.errors.length).toBeGreaterThan(0);
  });
});
