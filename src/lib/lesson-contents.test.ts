import { describe, expect, it } from "vitest";
import { summarizeLessonContents } from "./lesson-contents";
import {
  LESSON_PLAN_SECTION_IMAGES_META_KEY,
  mergeSectionImagesMeta,
  type LessonPlanResult,
} from "./lesson-plan";

const body = (label: string) => `${label} content long enough to count as real.`;

describe("summarizeLessonContents", () => {
  it("lists only the sections a lesson actually generated", () => {
    const content = JSON.stringify({
      "Full Lesson Plan": body("plan"),
      Worksheet: body("worksheet"),
    });

    expect(summarizeLessonContents(content)).toEqual([
      { id: "plan", label: "Plan" },
      { id: "worksheet", label: "Worksheet" },
    ]);
  });

  it("returns artifacts in the package's canonical order, not JSON key order", () => {
    // Deliberately written back-to-front.
    const content = JSON.stringify({
      "Teacher Notes": body("notes"),
      Worksheet: body("worksheet"),
      "Full Lesson Plan": body("plan"),
    });

    expect(summarizeLessonContents(content).map((a) => a.id)).toEqual([
      "plan",
      "worksheet",
      "notes",
    ]);
  });

  it("ignores a section that generated empty or near-empty", () => {
    const content = JSON.stringify({
      "Full Lesson Plan": body("plan"),
      Worksheet: "   ",
      "Homework Task": "",
      "Teacher Notes": "n/a",
    });

    expect(summarizeLessonContents(content).map((a) => a.id)).toEqual(["plan"]);
  });

  it("never mistakes stored image metadata for a document", () => {
    // The real write path merges meta keys into the same object it saves.
    const plan = { "Full Lesson Plan": body("plan") } as unknown as LessonPlanResult;
    const withMeta = mergeSectionImagesMeta(plan, {
      "Full Lesson Plan": ["https://example.test/a.png"],
    } as never);
    const content = JSON.stringify(withMeta);

    expect(content).toContain(LESSON_PLAN_SECTION_IMAGES_META_KEY);
    expect(summarizeLessonContents(content).map((a) => a.id)).toEqual(["plan"]);
  });

  it("counts slides from the separate ppt_content column on older rows", () => {
    const content = JSON.stringify({ "Full Lesson Plan": body("plan") });

    expect(summarizeLessonContents(content, body("slides")).map((a) => a.id)).toEqual([
      "plan",
      "slides",
    ]);
  });

  it("does not double-count slides present in both places", () => {
    const content = JSON.stringify({
      "PPT Slide Content": body("slides"),
    });

    expect(summarizeLessonContents(content, body("slides"))).toEqual([
      { id: "slides", label: "Slides" },
    ]);
  });

  it("degrades to an empty list rather than throwing on unusable content", () => {
    expect(summarizeLessonContents(null)).toEqual([]);
    expect(summarizeLessonContents(undefined)).toEqual([]);
    expect(summarizeLessonContents("")).toEqual([]);
    expect(summarizeLessonContents("{ truncated json")).toEqual([]);
    expect(summarizeLessonContents('"a bare string"')).toEqual([]);
    expect(summarizeLessonContents("[1,2,3]")).toEqual([]);
  });

  it("still reports slides when the JSON is unusable but ppt_content survived", () => {
    expect(summarizeLessonContents("{ truncated", body("slides")).map((a) => a.id)).toEqual([
      "slides",
    ]);
  });
});
