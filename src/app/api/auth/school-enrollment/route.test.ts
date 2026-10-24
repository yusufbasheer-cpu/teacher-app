import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.hoisted(() => vi.fn());
const processSchoolEnrollment = vi.hoisted(() => vi.fn());

vi.mock("@/lib/user-usage-server", () => ({ authenticateRequest }));
vi.mock("@/lib/school-enrollment-server", () => ({ processSchoolEnrollment }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ ok: true }),
  getClientIp: () => "127.0.0.1",
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));

import { POST } from "./route";

const post = (body: unknown) => POST(new Request("https://example.test/api/auth/school-enrollment", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
}));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  authenticateRequest.mockResolvedValue({
    ok: true,
    userId: "user-a",
    accessToken: "verified-token",
    supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-a", email: "teacher@school-a.test" } } }) } },
  });
  processSchoolEnrollment.mockResolvedValue({ ok: true, individual: false, newlyJoined: true });
});

afterEach(() => vi.clearAllMocks());

describe("school enrollment identity", () => {
  it("rejects an unauthenticated caller", async () => {
    authenticateRequest.mockResolvedValue({ ok: false, status: 401, message: "Unauthorized" });
    expect((await post({ email: "teacher@school-a.test" })).status).toBe(401);
    expect(processSchoolEnrollment).not.toHaveBeenCalled();
  });

  it("uses the verified Auth email and ignores a manipulated email", async () => {
    const response = await post({ email: "attacker@school-b.test", fromGoogleLogin: true });
    expect(response.status).toBe(200);
    expect(processSchoolEnrollment).toHaveBeenCalledWith("user-a", "teacher@school-a.test");
  });
});
