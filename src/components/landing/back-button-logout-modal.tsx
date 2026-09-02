"use client";

import { useCallback, useEffect, useState } from "react";
import { clearActiveSession } from "@/lib/active-session";
import { supabase } from "@/lib/supabase";
import { BG, BORDER, NAVY, TEXT_MUTED } from "@/lib/design-tokens";

/**
 * Mounted only on `/` (the homepage). If a signed-in user lands here via the
 * browser Back button (a `popstate` event — not a normal click/link visit),
 * ask whether they meant to log out instead of silently leaving them signed
 * in on the public marketing page.
 */
export function BackButtonLogoutModal() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const onPopState = () => {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) setUserId(session.user.id);
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const onStayLoggedIn = useCallback(() => setUserId(null), []);

  const onLogout = useCallback(async () => {
    if (!userId || loggingOut) return;
    setLoggingOut(true);
    try {
      await clearActiveSession(userId);
    } catch {
      /* ignore — local sign-out below still ends the session */
    }
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore — proceed to redirect regardless */
    }
    window.location.href = "/login";
  }, [userId, loggingOut]);

  if (!userId) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="back-logout-title"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "color-mix(in oklch, var(--text) 45%, transparent)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-xl"
        style={{ background: BG, border: `1px solid ${BORDER}` }}
      >
        <h2 id="back-logout-title" className="text-lg font-bold" style={{ color: NAVY }}>
          You&apos;re still logged in
        </h2>
        <p className="mt-2 text-sm" style={{ color: TEXT_MUTED }}>
          Do you want to log out of Layah?
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onStayLoggedIn}
            disabled={loggingOut}
            className="inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ color: NAVY, border: `1px solid ${BORDER}` }}
          >
            Stay logged in
          </button>
          <button
            type="button"
            onClick={() => void onLogout()}
            disabled={loggingOut}
            className="inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            style={{ background: "#ef4444" }}
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </div>
    </div>
  );
}
