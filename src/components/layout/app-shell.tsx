"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
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
      {/* Subtle canvas behind the white cards — without this, a centered
          narrow form on an identically-white background reads as broken
          empty space rather than an intentional layout on large screens. */}
      <div className="min-h-screen min-w-0 flex-1 bg-stone-50">{children}</div>
    </div>
  );
}
