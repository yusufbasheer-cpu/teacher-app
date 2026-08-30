"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Navbar } from "./navbar";
import { AppFrame } from "@/components/app/app-frame";

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
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setResolved(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setResolved(true);
    });

    return () => subscription.unsubscribe();
  }, []);

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
