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

function isActiveSessionsTableError(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const msg = error.message?.toLowerCase() ?? "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("active_sessions") && msg.includes("does not exist")
  );
}

/**
 * Register this device as the only active session (active_sessions table).
 * Columns: user_id, session_token, device_info
 */
export async function registerActiveSession(userId: string): Promise<string | null> {
  const sessionToken = crypto.randomUUID();
  const device_info = getDeviceInfo();

  const { error } = await supabase.from("active_sessions").upsert(
    {
      user_id: userId,
      session_token: sessionToken,
      device_info,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    if (isActiveSessionsTableError(error)) {
      console.warn("[active-session] active_sessions table unavailable:", error.message);
    } else {
      console.warn("[active-session] upsert failed:", error.message, error.code, error);
    }
    return null;
  }

  setLocalSessionToken(sessionToken);
  return sessionToken;
}

/** Remove active session row and local token on logout. */
export async function clearActiveSession(userId: string): Promise<void> {
  clearLocalSessionToken();

  const { error } = await supabase.from("active_sessions").delete().eq("user_id", userId);

  if (error && !isActiveSessionsTableError(error)) {
    console.warn("[active-session] delete failed:", error.message);
  }
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
    if (isActiveSessionsTableError(error)) {
      return { ok: true };
    }
    console.warn("[active-session] validate failed:", error.message);
    return { ok: true };
  }

  if (!data?.session_token) {
    if (!localToken) {
      await registerActiveSession(session.user.id);
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
  try {
    // scope: "local" — don't let a slow/failed network revoke delay clearing
    // this device's session (see UserMenu.onLogout for the same fix).
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* ignore — caller does a hard redirect regardless */
  }
}
