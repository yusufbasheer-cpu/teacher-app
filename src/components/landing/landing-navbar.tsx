"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LandingNavSound } from "@/components/landing/landing-nav-sound";
import { clearActiveSession } from "@/lib/active-session";
import { supabase } from "@/lib/supabase";

const NAVY = "#0A1628";
const TEAL = "#00C6A7";

type AuthUser = { email: string; displayName: string };

export function LandingNavbar() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const resolve = (sessionUser: { email?: string | null; user_metadata?: Record<string, unknown> } | null) => {
      if (!sessionUser) { setUser(null); return; }
      const firstName = (sessionUser.user_metadata?.full_name as string | undefined)?.split(" ")[0];
      const fallback = sessionUser.email?.split("@")[0] ?? "Teacher";
      setUser({ email: sessionUser.email ?? "", displayName: firstName ?? fallback });
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      resolve(session?.user ?? null);
      setReady(true);
    }).catch(() => setReady(true));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolve(session?.user ?? null);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const onLogout = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) await clearActiveSession(session.user.id);
    } catch { /* ignore */ }
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <header
      className="sticky top-0 z-50 bg-white"
      style={{ borderBottom: "2px solid rgba(0,198,167,0.2)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/landing" className="inline-flex shrink-0 items-center">
          <div className="rounded-xl px-2 py-1" style={{ background: NAVY }}>
            <img src="/Logo.png" alt="Layah" height={32} className="h-8 w-auto" style={{ height: 32 }} />
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {["Features", "How It Works"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-sm font-medium transition hover:opacity-70"
              style={{ color: "#374151" }}
            >
              {item}
            </a>
          ))}
          <Link href="/pricing" className="text-sm font-medium transition hover:opacity-70" style={{ color: "#374151" }}>
            Pricing
          </Link>
          <LandingNavSound />

          {/* Auth-aware CTA — hidden until ready to avoid flash */}
          {ready && (
            user ? (
              <>
                <span className="text-sm font-medium" style={{ color: "#374151" }}>
                  Hi, {user.displayName} 👋
                </span>
                <Link
                  href="/lesson-plan"
                  className="rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-80"
                  style={{ color: TEAL }}
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-gray-50"
                  style={{ borderColor: "#E5E7EB", color: "#374151" }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/auth" className="text-sm font-medium transition hover:opacity-70" style={{ color: "#374151" }}>
                  Login
                </Link>
                <Link
                  href="/lesson-plan"
                  className="btn-pulse rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90"
                  style={{ background: TEAL }}
                >
                  Get Started Free ✨
                </Link>
              </>
            )
          )}
        </nav>

        {/* Mobile — auth-aware */}
        <div className="flex items-center gap-2 md:hidden">
          {ready && (
            user ? (
              <Link
                href="/lesson-plan"
                className="rounded-xl px-4 py-2 text-sm font-bold text-white"
                style={{ background: TEAL }}
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/lesson-plan"
                className="rounded-xl px-4 py-2 text-sm font-bold text-white"
                style={{ background: TEAL }}
              >
                Get Started
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
