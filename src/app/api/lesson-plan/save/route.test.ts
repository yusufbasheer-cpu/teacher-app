import { beforeEach, describe, expect, it, vi } from "vitest";

const saveLessonPlanRecord = vi.hoisted(() => vi.fn());
const createServerSupabaseClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/lesson-plan-save", () => ({
  saveLessonPlanRecord,
  isValidLessonPlanSaveRequestBody: (value: unknown) => {
    if (!value || typeof value !== "object") return false;
    const body = value as { form?: unknown; lessonPlan?: unknown };
    return Boolean(body.form && body.lessonPlan);
  },
}));

vi.mock("@/lib/supabase-ssr", () => ({
  createServerSupabaseClient,
}));

describe("lesson-plan save route", () => {
  beforeEach(() => {
    vi.resetModules();
    saveLessonPlanRecord.mockReset();
    createServerSupabaseClient.mockReset();
  });

  it("returns 401 when no authenticated user is present", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/lesson-plan/save", {
        method: "POST",
        body: JSON.stringify({ form: {}, lessonPlan: {} }),
      }),
    );

    expect(res.status).toBe(401);
    expect(saveLessonPlanRecord).not.toHaveBeenCalled();
  });

  it("returns the saved id and inserted status when the helper succeeds", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
    });
    saveLessonPlanRecord.mockResolvedValue({ action: "inserted", id: "plan-123" });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/lesson-plan/save", {
        method: "POST",
        body: JSON.stringify({ form: { curriculumType: "CBSE/NCERT" }, lessonPlan: { x: "y" } }),
      }),
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ action: "inserted", id: "plan-123" });
    expect(saveLessonPlanRecord).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.objectContaining({
        form: { curriculumType: "CBSE/NCERT" },
        lessonPlan: { x: "y" },
      }),
    );
  });
});
