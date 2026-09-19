import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// These helpers are pure storage access; the module only imports the Supabase
// client for its other exports, and constructing it needs env vars.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import {
  LAYAH_SESSION_TOKEN_KEY,
  clearLocalSessionToken,
  getLocalSessionToken,
  setLocalSessionToken,
} from "./active-session";

/**
 * Regression coverage for "clicking any tab logs me out".
 *
 * The device token used to live in sessionStorage while Supabase keeps the auth
 * session in localStorage, so closing the tab dropped the token but not the
 * login — and `validateActiveSession` reads a missing token against a live
 * `active_sessions` row as "logged in from another device" and revokes.
 */

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    get size() {
      return map.size;
    },
  };
}

let local: ReturnType<typeof fakeStorage>;
let session: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  local = fakeStorage();
  session = fakeStorage();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("device session token persistence", () => {
  it("survives a closed tab, which is what the bug was", () => {
    setLocalSessionToken("token-a");
    // Closing the tab clears sessionStorage but not localStorage.
    session.removeItem(LAYAH_SESSION_TOKEN_KEY);

    expect(getLocalSessionToken()).toBe("token-a");
  });

  it("writes to localStorage, not sessionStorage", () => {
    setLocalSessionToken("token-b");

    expect(local.getItem(LAYAH_SESSION_TOKEN_KEY)).toBe("token-b");
    expect(session.getItem(LAYAH_SESSION_TOKEN_KEY)).toBeNull();
  });

  it("migrates a token left by the old sessionStorage build instead of logging the user out", () => {
    session.setItem(LAYAH_SESSION_TOKEN_KEY, "legacy-token");

    expect(getLocalSessionToken()).toBe("legacy-token");
    // Moved, not copied, so it cannot be resurrected after a later sign-out.
    expect(local.getItem(LAYAH_SESSION_TOKEN_KEY)).toBe("legacy-token");
    expect(session.getItem(LAYAH_SESSION_TOKEN_KEY)).toBeNull();
  });

  it("prefers localStorage when both are present", () => {
    local.setItem(LAYAH_SESSION_TOKEN_KEY, "current");
    session.setItem(LAYAH_SESSION_TOKEN_KEY, "stale");

    expect(getLocalSessionToken()).toBe("current");
  });

  it("clears both stores on sign-out", () => {
    local.setItem(LAYAH_SESSION_TOKEN_KEY, "a");
    session.setItem(LAYAH_SESSION_TOKEN_KEY, "b");

    clearLocalSessionToken();

    expect(local.getItem(LAYAH_SESSION_TOKEN_KEY)).toBeNull();
    expect(session.getItem(LAYAH_SESSION_TOKEN_KEY)).toBeNull();
  });

  it("returns null rather than throwing when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked in private mode");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });

    expect(getLocalSessionToken()).toBeNull();
    expect(() => setLocalSessionToken("x")).not.toThrow();
    expect(() => clearLocalSessionToken()).not.toThrow();
  });

  it("is inert during server rendering", () => {
    vi.stubGlobal("window", undefined);
    expect(getLocalSessionToken()).toBeNull();
  });
});
