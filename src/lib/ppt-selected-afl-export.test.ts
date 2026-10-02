import { describe, expect, it } from "vitest";
import { assembleFullPptFromSlideBodies } from "./ppt-slide-by-slide";
import { buildStructuredLessonSlides } from "./ppt-structured-lesson";

describe("selected AFL in the exported PPT deck", () => {
  it("keeps the implemented student task and speaker notes without appending a tool-purpose label", () => {
    const bodies = Array.from({ length: 13 }, () => "Write one topic-specific response in your notebook.");
    bodies[1] = [
      "K — What I Know: Write what the equals sign means in x + 4 = 9.",
      "W — What I Want to Know: Which operation would undo adding 4? Predict why.",
      "L — What I Learned: After investigating, explain how to check the value of x.",
    ].join("\n");
    bodies[8] = "3 Things You Learned: I can solve x + 4 = 9 because ____.\n2 Interesting Points: Write two ideas about inverse operations.\n1 Question: What happens if ____?";
    const notes = Array.from({ length: 13 }, () => "");
    notes[1] = "Timing: 5 minutes. Give students time to fill K and W; revisit L after the lesson.";
    const deck = buildStructuredLessonSlides({
      subject: "Mathematics", grade: "Grade 7", topic: "One-step equations",
      teacherName: "Test Teacher", learningObjectivesText: "Solve a one-step equation.",
      pptContent: assembleFullPptFromSlideBodies(bodies, false, false, notes),
      aflSelections: { starter: ["st-kwl-chart"] },
    });
    expect(deck[1]?.body).toContain("W — What I Want to Know");
    expect(deck[1]?.body).toContain("Which operation would undo adding 4?");
    expect(deck[1]?.body).not.toContain("Selected AFL");
    expect(deck[1]?.body).not.toContain("Activates prior knowledge");
    expect(deck[1]?.speakerNotes).toContain("Timing: 5 minutes");
    expect(deck[1]?.body).not.toContain("Timing:");
    expect(deck[8]?.body).toContain("because ____");
    expect(deck[8]?.body).toContain("if ____?");
  });
});
