import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabaseClient = vi.hoisted(() => vi.fn());
const isSuperAdmin = vi.hoisted(() => vi.fn());
const getSupabaseServiceRole = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-ssr", () => ({ createServerSupabaseClient }));
vi.mock("@/lib/super-admin", () => ({ isSuperAdmin }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseServiceRole }));

import { GET } from "./route";

describe("GET /api/super-admin/ai-usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerSupabaseClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "u", email: "admin@example.com" } } }) } });
  });
  it("rejects non-super-admins before reading the ledger", async () => {
    isSuperAdmin.mockResolvedValue(false);
    const response = await GET(new Request("https://example.test/api/super-admin/ai-usage"));
    expect(response.status).toBe(403);
    expect(getSupabaseServiceRole).not.toHaveBeenCalled();
  });
});
