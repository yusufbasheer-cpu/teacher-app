import { beforeEach, describe, expect, it, vi } from "vitest";

const saveLessonPlanRecord = vi.hoisted(() => vi.fn());
const createServerSupabaseClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/lesson-plan-save", async () => {
  const actual = await vi.importActual<typeof import("@/lib/lesson-plan-save")>("@/lib/lesson-plan-save");
  return {
    ...actual,
    saveLessonPlanRecord,
  };
});

vi.mock("@/lib/supabase-ssr", () => ({
  createServerSupabaseClient,
}));

describe("lesson-plan save route", () => {
  beforeEach(() => {
    vi.resetModules();
    saveLessonPlanRecord.mockReset();
    createServerSupabaseClient.mockReset();
  });

  function mockAuthenticatedUser() {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
    });
  }

  const validBody = {
    form: {
      curriculumType: "CBSE/NCERT",
      curriculumFramework: "",
      grade: "Grade 3",
      subject: "Math",
      chapter: "Fractions",
      topic: "Decimals",
      learningObjectives: "Objective text",
    },
    lessonPlan: { x: "y" },
  };

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

  it("returns 500 when auth lookup fails", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "boom" } }),
      },
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/lesson-plan/save", {
        method: "POST",
        body: JSON.stringify(validBody),
      }),
    );

    expect(res.status).toBe(500);
    expect(saveLessonPlanRecord).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    mockAuthenticatedUser();

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/lesson-plan/save", {
        method: "POST",
        body: "{not-json",
      }),
    );

    expect(res.status).toBe(400);
    expect(saveLessonPlanRecord).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid save payload", async () => {
    mockAuthenticatedUser();

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/lesson-plan/save", {
        method: "POST",
        body: JSON.stringify({ form: { curriculumType: "CBSE/NCERT" } }),
      }),
    );

    expect(res.status).toBe(400);
    expect(saveLessonPlanRecord).not.toHaveBeenCalled();
  });

  it("returns the saved id and inserted status when the helper succeeds", async () => {
    mockAuthenticatedUser();
    saveLessonPlanRecord.mockResolvedValue({ action: "inserted", id: "plan-123" });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/lesson-plan/save", {
        method: "POST",
        body: JSON.stringify(validBody),
      }),
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ action: "inserted", id: "plan-123" });
    expect(saveLessonPlanRecord).toHaveBeenCalledTimes(1);
    expect(saveLessonPlanRecord.mock.calls[0]?.[0]).toHaveProperty("auth");
    expect(saveLessonPlanRecord.mock.calls[0]?.[1]).toBe("user-1");
    expect(saveLessonPlanRecord.mock.calls[0]?.[2]).toMatchObject({
      form: { curriculumType: "CBSE/NCERT" },
      lessonPlan: { x: "y" },
    });
  });
});
