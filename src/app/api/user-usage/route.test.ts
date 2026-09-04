import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.hoisted(() => vi.fn());
const getOrCreateUserUsage = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/user-usage-server", () => ({ authenticateRequest, getOrCreateUserUsage }));

const usage = {
  planType: "free" as const,
  generationsUsed: 1,
  generationsLimit: 3,
  unlimited: false,
  canGenerate: true,
  resetDate: "2026-10-01",
};

describe("user-usage route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authenticateRequest.mockReset();
    getOrCreateUserUsage.mockReset();
  });

  it("keeps the existing Next contract by default", async () => {
    authenticateRequest.mockResolvedValue({ ok: true, supabase: {}, userId: "user-a" });
    getOrCreateUserUsage.mockResolvedValue(usage);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/user-usage"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      usage,
      upgradePitch: {
        headline: "You have used all your generations for this month.",
        subline: "Upgrade to Pro for 30 generations per month for just 15 AED.",
      },
    });
    expect(getOrCreateUserUsage).toHaveBeenCalledWith({}, "user-a");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves the existing unauthenticated response on Next", async () => {
    authenticateRequest.mockResolvedValue({
      ok: false,
      status: 401,
      message: "Unauthorized. Please log in.",
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/user-usage"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized. Please log in." });
  });

  it("forwards Authorization only when Python is selected", async () => {
    vi.stubEnv("BACKEND_ROUTE_USER_USAGE", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ usage, upgradePitch: { headline: "h", subline: "s" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/user-usage", {
        headers: {
          Authorization: "Bearer synthetic-token",
          Cookie: "session=must-not-forward",
          "x-client-data": "must-not-forward",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      usage,
      upgradePitch: { headline: "h", subline: "s" },
    });
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [URL, RequestInit];
    expect(url.toString()).toBe("https://python.internal/api/user-usage");
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer synthetic-token");
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("x-client-data")).toBe(false);
    expect(authenticateRequest).not.toHaveBeenCalled();
  });

  it("forwards Python auth errors without falling back", async () => {
    vi.stubEnv("BACKEND_ROUTE_USER_USAGE", "python");
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
    const response = await GET(new Request("http://localhost/api/user-usage"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid session. Please log in again." });
    expect(authenticateRequest).not.toHaveBeenCalled();
  });

  it("does not retry through Next after a Python transport failure", async () => {
    vi.stubEnv("BACKEND_ROUTE_USER_USAGE", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");
    const fetchMock = vi.fn(async () => {
      throw new TypeError("connection refused");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/user-usage"));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "User usage is temporarily unavailable. Please try again.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authenticateRequest).not.toHaveBeenCalled();
  });
});
