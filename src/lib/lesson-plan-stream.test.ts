import { describe, expect, it } from "vitest";
import { formatLessonPlanStreamEvent, parseLessonPlanStreamLine } from "./lesson-plan-stream";

describe("lesson-plan-stream", () => {
  it("formats stream events as NDJSON lines", () => {
    expect(
      formatLessonPlanStreamEvent({
        type: "progress",
        message: "Generating Slide 1 of 13",
      }),
    ).toBe('{"type":"progress","message":"Generating Slide 1 of 13"}\n');
  });

  it("parses JSON lines and ignores blanks or malformed lines", () => {
    expect(parseLessonPlanStreamLine("")).toBeNull();
    expect(parseLessonPlanStreamLine("   ")).toBeNull();
    expect(parseLessonPlanStreamLine("not json")).toBeNull();
    expect(parseLessonPlanStreamLine("[1,2,3]")).toBeNull();

    expect(parseLessonPlanStreamLine('{"type":"complete","usage":{"x":1}}')).toEqual({
      type: "complete",
      usage: { x: 1 },
    });
  });
});
