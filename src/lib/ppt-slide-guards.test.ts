import { describe, expect, it } from "vitest";
import {
  deckSdg,
  harmoniseSdgLine,
  isChapterLine,
  isTeacherOnlyLine,
  prepareDeckForStudents,
  separateTeacherText,
  stripLeadingBullet,
  studentWordCount,
  teacherKeywordsIn,
} from "./ppt-slide-guards";
import { moveTeacherFacingLinesToNotes, normalizeToLines } from "./ppt-template-engine";
import type { StructuredLessonSlideModel } from "./ppt-structured-lesson";

const model = (body: string, i = 1): StructuredLessonSlideModel => ({ slideTitle: `Slide ${i}`, body } as StructuredLessonSlideModel);

describe("FIX 1: teacher-facing text never stays on a student slide", () => {
  it("moves marking guides, marks totals, rubrics, compliance and lines about the teacher", () => {
    for (const line of [
      "Marking Guide (for teacher): 1 mark per correct label",
      "Total: 12 marks",
      "4 marks",
      "Use the rubric to score each answer.",
      "This activity meets KHDA inspection expectations.",
      "SPEA quality standards are met.",
      "Your teacher will check your work.",
    ]) expect(isTeacherOnlyLine(line), line).toBe(true);
    for (const line of ["Use question marks at the end of each question.", "Label the leaf, stem and root.", "The Ministry of Education runs a science fair."]) {
      expect(isTeacherOnlyLine(line), line).toBe(false);
    }
  });

  it("keeps the question but moves its inline marks to the notes", () => {
    const { studentLines, marking } = separateTeacherText("1. Name the gas plants take in. (2 marks)\nExplain why leaves are green. [3 marks]");
    expect(studentLines).toEqual(["1. Name the gas plants take in.", "Explain why leaves are green."]);
    expect(marking).toEqual(["1. Name the gas plants take in. — 2 marks", "Explain why leaves are green. — 3 marks"]);
  });

  it("the renderers' line mover puts all of it in the notes, with a Marking line", () => {
    const moved = moveTeacherFacingLinesToNotes(model("What do plants need? (2 marks)\nMarking guide: accept light, water, CO2\nTotal: 12 marks\nKHDA inspection link: Outstanding"));
    expect(moved.body).toBe("What do plants need?");
    expect(moved.speakerNotes).toContain("Marking:");
    expect(moved.speakerNotes).toContain("Total: 12 marks");
    expect(moved.speakerNotes).toContain("KHDA inspection link");
    expect(teacherKeywordsIn(moved.body)).toEqual([]);
  });
});

describe("FIX 2: word counts and the chapter shown once", () => {
  it("counts only what students see", () => {
    expect(studentWordCount("Name the gas plants take in. (2 marks)\nTotal: 12 marks")).toBe(6);
  });
  it("recognises repeated chapter lines but not ordinary content", () => {
    expect(isChapterLine("Chapter 7 — Getting to Know Plants (NCERT Science)")).toBe(true);
    expect(isChapterLine("Item 1 — Chapter: Getting to Know Plants")).toBe(true);
    expect(isChapterLine("Getting to Know Plants", "Getting to Know Plants")).toBe(true);
    expect(isChapterLine("Plants make food in their leaves.", "Getting to Know Plants")).toBe(false);
  });
  it("drops the chapter from later slides and moves a generated chapter to the title slide", () => {
    const deck = [model("Grade 6", 1), model("What do plants need?", 2), model("Chapter 7 — Getting to Know Plants (NCERT Science)\nTopic: Photosynthesis\nSDG 2 — Zero Hunger", 3)];
    const { deck: out, report } = prepareDeckForStudents(deck);
    expect(out[2]!.body).toBe("Topic: Photosynthesis\nSDG 2 — Zero Hunger");
    expect(out[0]!.body).toContain("Getting to Know Plants");
    expect(report.chapterLinesRemoved).toBe(1);
  });
});

describe("FIX 3: bullets and one SDG", () => {
  it("strips typed bullets but keeps minus signs and numbered steps", () => {
    expect(stripLeadingBullet("• Leaves make food")).toBe("Leaves make food");
    expect(stripLeadingBullet("·Roots absorb water")).toBe("Roots absorb water");
    expect(stripLeadingBullet("- * Stems carry water")).toBe("Stems carry water");
    expect(stripLeadingBullet("-5 °C is too cold for most plants")).toBe("-5 °C is too cold for most plants");
    expect(normalizeToLines("• Leaves make food\n1. Observe the leaf\n-5 °C")).toEqual(["Leaves make food", "Observe the leaf", "-5 °C"]);
  });
  it("uses slide 3's SDG with its official name, and fixes a chapter dropped into the SDG slot", () => {
    const deck = [model("Grade 6"), model("Starter"), model("Topic: Photosynthesis\nSDG 2 — zero hunger"), model("x")];
    const sdg = deckSdg(deck)!;
    expect(sdg).toEqual({ id: 2, name: "Zero Hunger" });
    expect(harmoniseSdgLine("SDG 7 — Getting to Know Plants", sdg)).toBe("SDG 2 — Zero Hunger");
    expect(harmoniseSdgLine("SDG: SDG 13 — Climate Action. The UAE plants mangroves.", sdg)).toBe("SDG: SDG 2 — Zero Hunger. The UAE plants mangroves.");
    expect(harmoniseSdgLine("SDG 2 — Zero Hunger — farms in the UAE grow dates", sdg)).toBe("SDG 2 — Zero Hunger — farms in the UAE grow dates");
    expect(harmoniseSdgLine("Plants need sunlight.", sdg)).toBe("Plants need sunlight.");
  });
});
