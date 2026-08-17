"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  forceLogoutSessionRevoked,
  SESSION_REVOKED_MESSAGE,
  validateActiveSession,
} from "@/lib/active-session";
import { isProtectedAppPath } from "@/lib/protected-routes";
import { supabase } from "@/lib/supabase";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * On protected routes, verifies this device's session token matches Supabase.
 * Re-checks every 5 minutes and on auth state changes.
 */
export function ActiveSessionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [revokedMessage, setRevokedMessage] = useState<string | null>(null);
  const checkingRef = useRef(false);

  const runCheck = useCallback(async () => {
    if (!isProtectedAppPath(pathname)) return;
    if (checkingRef.current) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    checkingRef.current = true;
    try {
      const result = await validateActiveSession();
      if (!result.ok && result.revoked) {
        setRevokedMessage(SESSION_REVOKED_MESSAGE);
        await forceLogoutSessionRevoked();
        // Hard navigation — same reasoning as UserMenu.onLogout: guarantees
        // every client component remounts from a clean auth state.
        window.location.href = "/login?revoked=1";
      }
    } finally {
      checkingRef.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    if (!isProtectedAppPath(pathname)) {
      setRevokedMessage(null);
      return;
    }

    void runCheck();

    const interval = window.setInterval(() => {
      void runCheck();
    }, CHECK_INTERVAL_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isProtectedAppPath(pathname)) return;
      if (event === "SIGNED_OUT") {
        setRevokedMessage(null);
        return;
      }
      if (session?.user) {
        void runCheck();
      }
    });

    return () => {
      window.clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [pathname, runCheck]);

  return (
    <>
      {revokedMessage ? (
        <div
          className="fixed inset-x-0 top-0 z-[100] px-4 py-3 text-center text-sm font-medium text-white shadow-lg"
          style={{ background: "#241A12", borderBottom: "2px solid #0E9484" }}
          role="alert"
        >
          {revokedMessage}
        </div>
      ) : null}
      {children}
    </>
  );
}
