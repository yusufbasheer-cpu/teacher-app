import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/user-usage-server", () => ({ authenticateRequest }));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseServiceRole: () => ({ from: () => ({ insert }) }),
}));
vi.mock("@/lib/send-email", () => ({ sendEmail }));
vi.mock("@/lib/rate-limit", () => ({
  HOUR_MS: 3_600_000,
  checkRateLimit: () => ({ ok: true }),
  getClientIp: () => "127.0.0.1",
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));

import { POST } from "./route";

const validBody = {
  adminEmail: "attacker@school-b.test",
  adminUserId: "user-b",
  schoolName: "School A",
  emailDomain: "school-a.test",
  country: "India",
  numTeachers: "Up to 10",
  phone: "",
  howHeard: "Google",
  planSelected: "School Starter",
  planPrice: "INR 1",
};

const post = () => POST(new Request("https://example.test/api/school-register", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(validBody),
}));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  authenticateRequest.mockResolvedValue({ ok: true, userId: "user-a", email: "owner@school-a.test" });
  insert.mockReturnValue({ select: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: "registration-1" }, error: null }) }) });
  sendEmail.mockResolvedValue({ ok: true });
});

afterEach(() => vi.clearAllMocks());

describe("school registration ownership", () => {
  it("rejects anonymous registration", async () => {
    authenticateRequest.mockResolvedValue({ ok: false, status: 401, message: "Unauthorized" });
    expect((await post()).status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it("binds the registration to the authenticated user, not browser ownership fields", async () => {
    expect((await post()).status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      admin_user_id: "user-a",
      admin_email: "owner@school-a.test",
      email_domain: "school-a.test",
    }));
  });
});
