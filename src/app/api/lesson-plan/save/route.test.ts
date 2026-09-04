import { beforeEach, describe, expect, it, vi } from "vitest";

const saveLessonPlanRecord = vi.hoisted(() => vi.fn());
const createServerSupabaseClient = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

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
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it("proxies the raw body and Authorization only when Python is selected", async () => {
    vi.stubEnv("BACKEND_ROUTE_LESSON_PLAN_SAVE", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ action: "inserted", id: "plan-python" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const rawBody = JSON.stringify(validBody);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/lesson-plan/save", {
        method: "POST",
        body: rawBody,
        headers: {
          Authorization: "Bearer synthetic-token",
          Cookie: "session=must-not-forward",
          "x-client-data": "must-not-forward",
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ action: "inserted", id: "plan-python" });
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [URL, RequestInit];
    expect(url.toString()).toBe("https://python.internal/api/lesson-plan/save");
    expect(init.body).toBe(rawBody);
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer synthetic-token");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("x-client-data")).toBe(false);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("does not retry through Next after a Python transport failure", async () => {
    vi.stubEnv("BACKEND_ROUTE_LESSON_PLAN_SAVE", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");
    const fetchMock = vi.fn(async () => {
      throw new TypeError("connection refused");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/lesson-plan/save", {
        method: "POST",
        body: JSON.stringify(validBody),
      }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Lesson plan saving is temporarily unavailable. Please try again.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
});
