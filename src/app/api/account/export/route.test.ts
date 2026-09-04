import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.hoisted(() => vi.fn());
const getSupabaseForUser = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/user-usage-server", () => ({ authenticateRequest, getSupabaseForUser }));
vi.mock("@/lib/rate-limit", () => ({
  HOUR_MS: 3_600_000,
  checkRateLimit: () => ({ ok: true }),
  getClientIp: () => "127.0.0.1",
  rateLimitResponse: vi.fn(),
}));

const lesson = {
  id: "plan-a",
  subject: "Math",
  grade: "Grade 3",
  curriculum_type: "CBSE/NCERT",
  curriculum_framework: "",
  topic: "Fractions",
  learning_objectives: "Compare fractions",
  lesson_plan: { "Full Lesson Plan": "Owned content" },
  created_at: "2026-09-03T00:00:00Z",
};

function configureNextPath() {
  authenticateRequest.mockResolvedValue({
    ok: true,
    userId: "user-a",
    accessToken: "synthetic-token",
  });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            email: "a@example.test",
            created_at: "2026-01-01T00:00:00Z",
            last_sign_in_at: "2026-09-04T00:00:00Z",
            app_metadata: { provider: "google" },
          },
        },
      }),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() =>
          table === "user_usage"
            ? {
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    plan_type: "free",
                    generations_used: 1,
                    generations_limit: 3,
                    reset_date: "2026-10-01",
                    created_at: "2026-01-01T00:00:00Z",
                  },
                }),
              }
            : { order: vi.fn().mockResolvedValue({ data: [lesson] }) },
        ),
      })),
    })),
  };
  getSupabaseForUser.mockReturnValue(client);
  return client;
}

describe("account export route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authenticateRequest.mockReset();
    getSupabaseForUser.mockReset();
  });

  it("keeps the existing Next export contract by default", async () => {
    const client = configureNextPath();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/account/export"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="layah-my-data.json"',
    );
    const payload = await response.json();
    expect(payload.account).toEqual({
      email: "a@example.test",
      created_at: "2026-01-01T00:00:00Z",
      last_sign_in: "2026-09-04T00:00:00Z",
      auth_provider: "google",
    });
    expect(payload.lesson_plans).toEqual([{ ...lesson, content: lesson.lesson_plan, lesson_plan: undefined }]);
    expect(payload.summary).toEqual({ total_lesson_plans: 1 });
    expect(client.from).toHaveBeenCalledWith("user_usage");
    expect(client.from).toHaveBeenCalledWith("lesson_plans");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards only Authorization and preserves export headers through Python", async () => {
    vi.stubEnv("BACKEND_ROUTE_ACCOUNT_EXPORT", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ summary: { total_lesson_plans: 0 } }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-disposition": 'attachment; filename="layah-my-data.json"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/account/export", {
        headers: {
          Authorization: "Bearer synthetic-token",
          Cookie: "session=must-not-forward",
          "x-client-data": "must-not-forward",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="layah-my-data.json"',
    );
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [URL, RequestInit];
    expect(url.toString()).toBe("https://python.internal/api/account/export");
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer synthetic-token");
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("x-client-data")).toBe(false);
    expect(authenticateRequest).not.toHaveBeenCalled();
  });

  it("falls back to the existing Next read on Python transport failure", async () => {
    vi.stubEnv("BACKEND_ROUTE_ACCOUNT_EXPORT", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");
    configureNextPath();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("connection refused");
      }),
    );

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/account/export"));

    expect(response.status).toBe(200);
    expect((await response.json()).summary).toEqual({ total_lesson_plans: 1 });
    expect(authenticateRequest).toHaveBeenCalledTimes(1);
  });

  it("forwards valid Python auth errors without fallback", async () => {
    vi.stubEnv("BACKEND_ROUTE_ACCOUNT_EXPORT", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Invalid session. Please log in again." }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/account/export"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid session. Please log in again." });
    expect(authenticateRequest).not.toHaveBeenCalled();
  });
});
