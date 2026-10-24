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
});
