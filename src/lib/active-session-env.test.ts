import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  supabase: { from, auth: { getSession, signOut: vi.fn() } },
}));

import {
  clearActiveSession,
  registerActiveSession,
  validateActiveSession,
} from "./active-session";

/**
 * Preview deployments point at the same Supabase project as production, so
 * `active_sessions` — one row per user — is shared. Before this gating,
 * signing in on staging rotated production's token and logged the real user
 * out, signing out of staging deleted their row outright, and staging revoked
 * itself the moment anyone touched production.
 */

function setHost(hostname: string) {
  vi.stubGlobal("window", { location: { hostname } });
}

const storage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
};

beforeEach(() => {
  from.mockReset();
  getSession.mockReset();
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  vi.stubGlobal("crypto", { randomUUID: () => "generated-token" });
  vi.stubGlobal("navigator", { userAgent: "test", platform: "test", language: "en" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("active_sessions is never touched outside production", () => {
  it("does not write the shared row when registering on staging", async () => {
    setHost("staging.layah.in");

    const token = await registerActiveSession("user-1");

    expect(from).not.toHaveBeenCalled();
    // Still hands back a token so the rest of the login flow is unchanged.
    expect(token).toBe("generated-token");
  });

  it("does not delete the shared row when signing out of staging", async () => {
    setHost("staging.layah.in");

    await clearActiveSession("user-1");

    expect(from).not.toHaveBeenCalled();
  });

  it("never revokes on staging, and does not even read the row", async () => {
    setHost("staging.layah.in");

    await expect(validateActiveSession()).resolves.toEqual({ ok: true });
    expect(from).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("still enforces a single session on production", async () => {
    setHost("www.layah.in");
    getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { session_token: "someone-else" } }),
        }),
      }),
    });

    // Local token is absent, the row belongs to another device: revoke.
    await expect(validateActiveSession()).resolves.toEqual({ ok: false, revoked: true });
    expect(from).toHaveBeenCalledWith("active_sessions");
  });

  it("still writes the shared row when registering on production", async () => {
    setHost("www.layah.in");
    from.mockReturnValue({ upsert: () => Promise.resolve({ error: null }) });

    await registerActiveSession("user-1");

    expect(from).toHaveBeenCalledWith("active_sessions");
  });
});
