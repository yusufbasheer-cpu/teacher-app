import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const SESSION_WAIT_MS = 80;
const SESSION_MAX_ATTEMPTS = 40;

/**
 * After Google OAuth redirect, exchange PKCE code (if present) and wait for a session.
 */
export async function resolveGoogleOAuthSession(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (code) {
    console.log("[google-oauth] Exchanging PKCE code for session");
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[google-oauth] exchangeCodeForSession failed:", error.message);
      return null;
    }
    window.history.replaceState({}, document.title, "/dashboard");
  }

  for (let attempt = 0; attempt < SESSION_MAX_ATTEMPTS; attempt += 1) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.email) {
      console.log("[google-oauth] Session ready", {
        userId: session.user.id,
        email: session.user.email,
      });
      return session;
    }

    await new Promise((resolve) => setTimeout(resolve, SESSION_WAIT_MS));
  }

  console.warn("[google-oauth] Timed out waiting for session after redirect");
  return null;
}
