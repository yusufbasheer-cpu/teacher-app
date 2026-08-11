"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { BG_SOFT } from "@/lib/design-tokens";
import { Navbar } from "./navbar";
import { AppSidebar } from "./app-sidebar";

/** Chooses the page chrome: no header on /landing, the marketing top nav for
 * signed-out visitors, or the app sidebar once a session is present. */
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

  if (pathname === "/landing") {
    return <>{children}</>;
  }

  if (!user) {
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
