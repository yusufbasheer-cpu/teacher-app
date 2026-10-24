import { describe, expect, it } from "vitest";
import { lessonPackageStages, previewLinesFromComponent, slideTextFromOutline, type LessonPackageSignals } from "./lesson-package-stages";

const FULL = ["Full Lesson Plan", "PPT Slide Content", "Worksheet", "Homework Task", "AFL Activity Sheets"];
const base: LessonPackageSignals = { sections: FULL, progress: null, contentReady: false, gamma: null, files: "pending" };
const statuses = (s: LessonPackageSignals) => Object.fromEntries(lessonPackageStages(s).map((x) => [x.id, x.status]));

describe("lessonPackageStages", () => {
  it("starts on the first selected section, nothing else active", () => {
    expect(statuses(base)).toEqual({ lesson: "active", slides: "pending", resources: "pending", afl: "pending", files: "pending" });
  });

  it("uses the real component count, and a component message means the lesson plan is done", () => {
    const stages = lessonPackageStages({ ...base, progress: "Writing component 7 of 13" });
    expect(stages.find((s) => s.id === "lesson")!.status).toBe("done");
    const slides = stages.find((s) => s.id === "slides")!;
    expect(slides.status).toBe("active");
    expect(slides.count).toEqual({ done: 7, total: 13 });
  });

  it("moves to the next section once every slide is written", () => {
    expect(statuses({ ...base, progress: "Writing component 13 of 13" })).toMatchObject({ slides: "done", resources: "active" });
  });

  it("keeps the last stage active while the server finishes after its last announcement", () => {
    const stages = lessonPackageStages({ ...base, sections: ["PPT Slide Content"], progress: "Writing component 13 of 13" });
    expect(stages[0]).toMatchObject({ status: "active", detail: "Finishing your package" });
  });

  it("shows one honest stage when nothing is streamed (no PPT)", () => {
    const stages = lessonPackageStages({ ...base, sections: ["Full Lesson Plan", "Worksheet"] });
    expect(stages).toHaveLength(2);
    expect(stages[0]).toMatchObject({ status: "active", detail: "Writing your lesson plan and worksheet" });
  });

  it("never shows the content check before the Gamma deck returns, and reports its verdict after", () => {
    const designing = statuses({ ...base, contentReady: true, gamma: { phase: "designing", resumes: 0 } });
    expect(designing).toMatchObject({ afl: "done", design: "active", check: "pending" });
    const failed = statuses({ ...base, contentReady: true, gamma: { phase: "done", resumes: 0, verdict: { tone: "bad", title: "x" } } });
    expect(failed).toMatchObject({ design: "done", check: "error" });
    expect(statuses({ ...base, contentReady: true, files: "active", gamma: { phase: "done", resumes: 0, verdict: { tone: "ok", title: "x" } } })).toMatchObject({ check: "done", files: "active" });
  });
});

describe("slideTextFromOutline", () => {
  it("pairs bodies with canonical titles and drops trailers", () => {
    const outline = "Cover\nPlants · Grade 6\n\nStarter\n- What do plants need?\n- **Think** pair share\n<!--__LAYAH_TEACHER_NOTES__[]-->";
    expect(slideTextFromOutline(outline, ["Cover", "Starter", "Missing"])).toEqual([
      { title: "Cover", lines: ["Plants · Grade 6"] },
      { title: "Starter", lines: ["What do plants need?", "Think pair share"] },
      { title: "Missing", lines: [] },
    ]);
  });
  it("shows real streamed component text before the complete outline arrives", () => {
    expect(previewLinesFromComponent("- **Locate** latitude\n2. Compare two places\nTeacher notes: hidden")).toEqual(["Locate latitude", "Compare two places"]);
  });
});
