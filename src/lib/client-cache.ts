import { supabase } from "@/lib/supabase";

/**
 * Tiny in-memory stale-while-revalidate store for *private* client data.
 *
 * Deliberately not a framework: three fetch sites need "show what I had, then
 * refresh". Safety rules, all enforced here rather than at call sites:
 *  - entries are keyed by authenticated user id, so one account can never read
 *    another's entry even if a clear were missed;
 *  - the whole store is dropped on sign-out or when the signed-in user changes
 *    (account switch, session revocation both surface as auth state changes);
 *  - `isCurrentUser` lets a request that started under user A refuse to
 *    publish its result after the session moved to user B.
 *
 * Never put plan, credit, entitlement or payment decisions in here — the server
 * decides those, and a stale copy must not look authoritative.
 */

export const PALETTE_LESSONS_KEY = "palette-lessons";

const store = new Map<string, unknown>();
const listeners = new Set<() => void>();
// undefined = no auth event seen yet; null = known signed out.
let activeUser: string | null | undefined;
let wired = false;

function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  supabase.auth.onAuthStateChange((event, session) => {
    const next = session?.user?.id ?? null;
    const changed = event === "SIGNED_OUT" || (typeof activeUser === "string" && next !== activeUser);
    activeUser = next;
    if (changed) {
      store.clear();
      listeners.forEach((fn) => fn());
    }
  });
}

const k = (userId: string, key: string) => `${userId}:${key}`;

export function cacheGet<T>(userId: string, key: string): T | undefined {
  wire();
  return store.get(k(userId, key)) as T | undefined;
}

export function cacheSet(userId: string, key: string, value: unknown) {
  wire();
  store.set(k(userId, key), value);
}

/** Drop every entry for `key` (any user) — call after a mutation that changes it. */
export function cacheInvalidate(key: string) {
  for (const entry of store.keys()) if (entry.endsWith(`:${key}`)) store.delete(entry);
}

/** False once the session has moved to a different user than `userId`. */
export function isCurrentUser(userId: string) {
  return activeUser === undefined || activeUser === userId;
}

/** Runs when the cache is cleared (sign-out / account change). Returns unsubscribe. */
export function onUserChange(fn: () => void) {
  wire();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
