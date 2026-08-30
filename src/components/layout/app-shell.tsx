"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { clearActiveSession } from "@/lib/active-session";
import { isProtectedAppPath } from "@/lib/protected-routes";
import { supabase } from "@/lib/supabase";
import { Navbar } from "./navbar";
import { AppFrame } from "@/components/app/app-frame";

function isAuthRoute(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup" || pathname.startsWith("/auth");
}

function isProtectedClientRoute(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname === "/overview" ||
    pathname === "/settings" ||
    pathname === "/school-admin" ||
    pathname === "/hod-dashboard" ||
    pathname === "/my-lesson-plans" ||
    pathname.startsWith("/my-lesson-plans/") ||
    isProtectedAppPath(pathname)
  );
}

/**
 * Chooses the page chrome.
 *
 * - `/` and `/super-admin` render their own shells (the marketing homepage and
 *   the operator console) and are passed through untouched.
 * - Signed out: the marketing top nav.
 * - Signed in: the app frame — rail, top bar, command palette.
 *
 * The session is resolved before deciding, and nothing is rendered in the
 * meantime, so the app never paints signed-out chrome and then swaps it for
 * signed-in chrome half a second later.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const syncAuthAndHistory = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session?.user && isAuthRoute(window.location.pathname)) {
        // Back/forward cache can resurrect an auth page while the user is still
        // signed in. Treat that as a logout boundary so browser history does not
        // keep shuttling between a live dashboard and a stale login page.
        try {
          await clearActiveSession(session.user.id);
        } catch {
          /* ignore â€” local sign-out below still clears this device */
        }
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          /* ignore â€” redirect below is the important part */
        }
        if (!cancelled) {
          setUser(null);
          setResolved(true);
          window.location.href = "/login";
        }
        return;
      }

      if (!session?.user && isProtectedClientRoute(window.location.pathname)) {
        // If a protected page is restored from history after logout, do not let
        // the cached UI linger â€” send the user back to the login screen.
        setUser(null);
        setResolved(true);
        window.location.replace("/login");
        return;
      }

      setUser(session?.user ?? null);
      setResolved(true);
    };

    void syncAuthAndHistory();

    const onHistoryNavigate = () => {
      void syncAuthAndHistory();
    };

    window.addEventListener("pageshow", onHistoryNavigate);
    window.addEventListener("popstate", onHistoryNavigate);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      setResolved(true);
    });

    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onHistoryNavigate);
      window.removeEventListener("popstate", onHistoryNavigate);
      subscription.unsubscribe();
    };
  }, [pathname]);

  const ownChrome = pathname === "/" || pathname.startsWith("/super-admin");
  if (ownChrome) return <>{children}</>;

  if (!resolved) {
    // Hold the frame's shape rather than flashing an unstyled page. No spinner:
    // this resolves from local storage in a few milliseconds, and a spinner
    // that appears and vanishes reads as jank.
    return <div className="min-h-screen bg-canvas" aria-hidden />;
  }

  if (!user) {
    return (
      <>
        <Navbar />
        {children}
      </>
    );
  }

  return <AppFrame user={user}>{children}</AppFrame>;
}
