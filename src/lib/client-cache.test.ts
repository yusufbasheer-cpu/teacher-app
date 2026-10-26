import { beforeEach, describe, expect, it, vi } from "vitest";

let authCb: (event: string, session: { user: { id: string } } | null) => void = () => {};
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { onAuthStateChange: (cb: typeof authCb) => { authCb = cb; } } },
}));

describe("client-cache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", {});
  });

  it("scopes entries by user and clears on sign-out and account change", async () => {
    const c = await import("./client-cache");
    c.cacheSet("a", "lessons", [1]);
    expect(c.cacheGet("a", "lessons")).toEqual([1]);
    expect(c.cacheGet("b", "lessons")).toBeUndefined();

    const cleared = vi.fn();
    c.onUserChange(cleared);
    authCb("INITIAL_SESSION", { user: { id: "a" } });
    expect(c.cacheGet("a", "lessons")).toEqual([1]); // first session is not a "change"
    authCb("SIGNED_IN", { user: { id: "b" } });
    expect(c.cacheGet("a", "lessons")).toBeUndefined();
    expect(cleared).toHaveBeenCalledTimes(1);
    expect(c.isCurrentUser("a")).toBe(false);
    expect(c.isCurrentUser("b")).toBe(true);

    c.cacheSet("b", "lessons", [2]);
    authCb("SIGNED_OUT", null);
    expect(c.cacheGet("b", "lessons")).toBeUndefined();
  });

  it("rejects a late response for a user who has signed out", async () => {
    const c = await import("./client-cache");
    c.cacheGet("a", "x"); // first use subscribes to auth events
    authCb("INITIAL_SESSION", { user: { id: "a" } });
    authCb("SIGNED_OUT", null);
    expect(c.isCurrentUser("a")).toBe(false);
  });

  it("invalidates a key for every user", async () => {
    const c = await import("./client-cache");
    c.cacheSet("a", "lessons", 1);
    c.cacheSet("a", "other", 2);
    c.cacheInvalidate("lessons");
    expect(c.cacheGet("a", "lessons")).toBeUndefined();
    expect(c.cacheGet("a", "other")).toBe(2);
  });
});
