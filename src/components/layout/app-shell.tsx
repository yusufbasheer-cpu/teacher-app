"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { BG_SOFT } from "@/lib/design-tokens";
import { isProtectedAppPath } from "@/lib/protected-routes";
import { Navbar } from "./navbar";
import { AppSidebar } from "./app-sidebar";

/**
 * Dashboard routes beyond PROTECTED_APP_PATHS (protected-routes.ts) — pages
 * that only make sense signed in, but aren't AI-generation routes.
 */
function isProtectedClientRoute(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname === "/overview" ||
    pathname === "/settings" ||
    pathname === "/school-admin" ||
    pathname === "/hod-dashboard" ||
    isProtectedAppPath(pathname)
  );
}

/** Chooses the page chrome: no header on the homepage (`/`, which renders
 * its own Navbar), the marketing top nav for signed-out visitors (or a
 * signed-in visitor on a non-dashboard page — /about, /pricing, etc. — so the
 * app sidebar doesn't leak onto public pages), or the app sidebar on an
 * actual dashboard route once a session is present. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (pathname === "/" || pathname.startsWith("/super-admin")) {
    return <>{children}</>;
  }

  if (!user || !isProtectedClientRoute(pathname)) {
    return (
      <>
        <Navbar />
        {children}
      </>
    );
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar user={user} />
      {/* Canvas behind the cards. Same warm-cream family as the sidebar
          (BG_SOFT is a shade darker than the sidebar/card cream BG) so the
          two form one continuous surface instead of a cream sidebar sitting
          next to an unrelated gray page — this is the single source of truth
          for the authenticated app's background; do not re-override it per
          page. */}
      <div className="min-h-screen min-w-0 flex-1" style={{ background: BG_SOFT }}>
        {children}
      </div>
    </div>
  );
}
