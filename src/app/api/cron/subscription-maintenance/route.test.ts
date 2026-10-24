import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseServiceRole = vi.hoisted(() => vi.fn());
const reconcileAllSubscriptions = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseServiceRole }));
vi.mock("@/lib/subscription-billing", () => ({ reconcileAllSubscriptions }));

import { GET } from "./route";

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "cron-secret-value");
  getSupabaseServiceRole.mockReturnValue({});
  reconcileAllSubscriptions.mockResolvedValue({ processed: 2 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("subscription maintenance authorization", () => {
  it("rejects an anonymous request even if it spoofs Vercel's schedule header", async () => {
    const response = await GET(new Request("https://example.test/api/cron/subscription-maintenance", {
      headers: { "x-vercel-cron-schedule": "0 0 * * *" },
    }));

    expect(response.status).toBe(401);
    expect(reconcileAllSubscriptions).not.toHaveBeenCalled();
  });

  it("rejects an invalid internal token", async () => {
    const response = await GET(new Request("https://example.test/api/cron/subscription-maintenance", {
      headers: { authorization: "Bearer wrong" },
    }));

    expect(response.status).toBe(401);
    expect(reconcileAllSubscriptions).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(new Request("https://example.test/api/cron/subscription-maintenance", {
      headers: { authorization: "Bearer cron-secret-value" },
    }));

    expect(response.status).toBe(401);
    expect(getSupabaseServiceRole).not.toHaveBeenCalled();
    expect(reconcileAllSubscriptions).not.toHaveBeenCalled();
  });

  it("does not accept an ordinary user session", async () => {
    const response = await GET(new Request("https://example.test/api/cron/subscription-maintenance", {
      headers: {
        authorization: "Bearer ordinary-user-access-token",
        cookie: "sb-access-token=ordinary-user-access-token",
      },
    }));

    expect(response.status).toBe(401);
    expect(getSupabaseServiceRole).not.toHaveBeenCalled();
    expect(reconcileAllSubscriptions).not.toHaveBeenCalled();
  });

  it("allows the configured Vercel cron bearer token", async () => {
    const response = await GET(new Request("https://example.test/api/cron/subscription-maintenance", {
      headers: { authorization: "Bearer cron-secret-value" },
    }));

    expect(response.status).toBe(200);
    expect(reconcileAllSubscriptions).toHaveBeenCalledTimes(1);
  });
});
