import { describe, expect, it, vi } from "vitest";
import { buildLessonPlanSavePayload, saveLessonPlanRecord } from "./lesson-plan-save";

describe("buildLessonPlanSavePayload", () => {
  it("keeps the current lesson_plan metadata and normalizes user fields", () => {
    const payload = buildLessonPlanSavePayload({
      userId: "user-1",
      activePlanId: "plan-1",
      form: {
        curriculumType: "CBSE/NCERT",
        curriculumFramework: "  ",
        grade: "Grade 3",
        subject: "Math",
        chapter: "  Fractions ",
        topic: "Decimals",
        learningObjectives: "Objective text",
      },
      lessonPlan: {
        "Full Lesson Plan": "Plan",
      },
      sectionImages: {
        "Full Lesson Plan": ["https://example.com/slide.png"],
      },
      pptSlideImageUrls: ["https://example.com/ppt.png", null],
    });

    expect(payload).toMatchObject({
      user_id: "user-1",
      curriculum_type: "CBSE/NCERT",
      curriculum_framework: "",
      grade: "Grade 3",
      subject: "Math",
      chapter: "Fractions",
      topic: "Decimals",
      learning_objectives: "Objective text",
    });
    expect(payload.lesson_plan["Full Lesson Plan"]).toBe("Plan");
    expect(payload.lesson_plan["__sectionImageUrls"]).toBeDefined();
    expect(payload.lesson_plan["__pptSlideImageUrls"]).toBeDefined();
  });
});

describe("saveLessonPlanRecord", () => {
  it("updates the existing row when activePlanId is present", async () => {
    const updatePayloads: unknown[] = [];
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const from = vi.fn().mockReturnValue({
      update: (payload: unknown) => {
        updatePayloads.push(payload);
        return update(payload);
      },
    });
    const supabase = { from } as never;

    const result = await saveLessonPlanRecord(supabase, "user-1", {
      activePlanId: "plan-1",
      form: {
        curriculumType: "CBSE/NCERT",
        curriculumFramework: "",
        grade: "Grade 3",
        subject: "Math",
        chapter: "Fractions",
        topic: "Decimals",
        learningObjectives: "Objective text",
      },
      lessonPlan: { "Full Lesson Plan": "Plan" },
    });

    expect(result).toEqual({ action: "updated", id: "plan-1" });
    expect(from).toHaveBeenCalledWith("lesson_plans");
    expect(update).toHaveBeenCalledTimes(1);
    expect(updatePayloads[0]).toMatchObject({
      user_id: "user-1",
      curriculum_type: "CBSE/NCERT",
      curriculum_framework: "",
      grade: "Grade 3",
      subject: "Math",
      chapter: "Fractions",
      topic: "Decimals",
      learning_objectives: "Objective text",
    });
  });

  it("throws when updating fails", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: "update failed" } }),
      }),
    });
    const from = vi.fn().mockReturnValue({ update });
    const supabase = { from } as never;

    await expect(
      saveLessonPlanRecord(supabase, "user-1", {
        activePlanId: "plan-1",
        form: {
          curriculumType: "CBSE/NCERT",
          curriculumFramework: "",
          grade: "Grade 3",
          subject: "Math",
          chapter: "Fractions",
          topic: "Decimals",
          learningObjectives: "Objective text",
        },
        lessonPlan: { "Full Lesson Plan": "Plan" },
      }),
    ).rejects.toThrow("update failed");
  });

  it("inserts a new row and returns the new id", async () => {
    const insertPayloads: unknown[] = [];
    const single = vi.fn().mockResolvedValue({ data: { id: "new-plan" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockImplementation((payload: unknown) => {
      insertPayloads.push(payload);
      return { select };
    });
    const from = vi.fn().mockReturnValue({ insert });
    const supabase = { from } as never;

    const result = await saveLessonPlanRecord(supabase, "user-1", {
      form: {
        curriculumType: "CBSE/NCERT",
        curriculumFramework: "",
        grade: "Grade 3",
        subject: "Math",
        chapter: "Fractions",
        topic: "Decimals",
        learningObjectives: "Objective text",
      },
      lessonPlan: { "Full Lesson Plan": "Plan" },
    });

    expect(result).toEqual({ action: "inserted", id: "new-plan" });
    expect(from).toHaveBeenCalledWith("lesson_plans");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insertPayloads[0]).toMatchObject({
      user_id: "user-1",
      curriculum_type: "CBSE/NCERT",
      curriculum_framework: "",
      grade: "Grade 3",
      subject: "Math",
      chapter: "Fractions",
      topic: "Decimals",
      learning_objectives: "Objective text",
    });
  });

  it("throws when insert returns an error", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "insert failed" } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const supabase = { from } as never;

    await expect(
      saveLessonPlanRecord(supabase, "user-1", {
        form: {
          curriculumType: "CBSE/NCERT",
          curriculumFramework: "",
          grade: "Grade 3",
          subject: "Math",
          chapter: "Fractions",
          topic: "Decimals",
          learningObjectives: "Objective text",
        },
        lessonPlan: { "Full Lesson Plan": "Plan" },
      }),
    ).rejects.toThrow("insert failed");
  });
});
