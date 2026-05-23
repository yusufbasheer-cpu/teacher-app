import { supabase } from "@/lib/supabase";

export const LAYAH_SESSION_TOKEN_KEY = "layah_active_session_token";

export const SESSION_REVOKED_MESSAGE =
  "Your account was logged in from another device. You have been logged out for security. Please log in again.";

export function getLocalSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(LAYAH_SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setLocalSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LAYAH_SESSION_TOKEN_KEY, token);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearLocalSessionToken(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(LAYAH_SESSION_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getDeviceInfo(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent?.slice(0, 280) ?? "unknown";
  const platform = navigator.platform ?? "unknown";
  const lang = navigator.language ?? "";
  return `${platform} | ${lang} | ${ua}`;
}

/** Register this device as the only active session for the user. */
export async function registerActiveSession(userId: string): Promise<string> {
  const sessionToken = crypto.randomUUID();
  const device_info = getDeviceInfo();

  const { error } = await supabase.from("active_sessions").upsert(
    {
      user_id: userId,
      session_token: sessionToken,
      created_at: new Date().toISOString(),
      device_info,
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
  setLocalSessionToken(sessionToken);
  return sessionToken;
}

/** Remove active session row and local token on logout. */
export async function clearActiveSession(userId: string): Promise<void> {
  clearLocalSessionToken();
  await supabase.from("active_sessions").delete().eq("user_id", userId);
}

export type ValidateActiveSessionResult =
  | { ok: true }
  | { ok: false; revoked: true };

/**
 * Returns revoked when Supabase auth exists but this device's token
 * does not match the latest session in the database.
 */
export async function validateActiveSession(): Promise<ValidateActiveSessionResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return { ok: true };
  }

  const localToken = getLocalSessionToken();

  const { data, error } = await supabase
    .from("active_sessions")
    .select("session_token")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    console.warn("[active-session] validate failed:", error.message);
    return { ok: true };
  }

  if (!data?.session_token) {
    if (!localToken) {
      try {
        await registerActiveSession(session.user.id);
      } catch (e) {
        console.warn("[active-session] register failed:", e);
      }
      return { ok: true };
    }
    return { ok: false, revoked: true };
  }

  if (!localToken || localToken !== data.session_token) {
    return { ok: false, revoked: true };
  }

  return { ok: true };
}

export async function forceLogoutSessionRevoked(): Promise<void> {
  clearLocalSessionToken();
  await supabase.auth.signOut();
}
