"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { SoundToggleButton } from "@/components/effects/sound-toggle-button";
import { clearActiveSession } from "@/lib/active-session";
import { APP_NAV_LINKS, isNavLinkActive } from "@/lib/app-nav-links";
import { supabase } from "@/lib/supabase";
import { Container } from "@/components/ui/container";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const onLogout = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      await clearActiveSession(session.user.id);
    }
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  };

  return (
    <header
      className="sticky top-0 z-50 shadow-sm"
      style={{ background: "#0A1628", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <Container className="py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex shrink-0 items-center">
            <img
              src="/Logo.png"
              alt="Layah"
              height={40}
              className="h-10 w-auto"
              style={{ height: 40, width: "auto" }}
            />
          </Link>

          <nav className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-1 lg:flex">
            {APP_NAV_LINKS.map((link) => {
              const active = isNavLinkActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition"
                  style={{
                    color: active ? "#00C6A7" : "rgba(255,255,255,0.7)",
                    background: active ? "rgba(0,198,167,0.1)" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
            <SoundToggleButton />
            {user ? (
              <button
                type="button"
                onClick={onLogout}
                className="ml-1 inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "#00C6A7" }}
              >
                Logout
              </button>
            ) : (
              <Link
                href="/auth"
                className="ml-1 inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "#00C6A7" }}
              >
                Login
              </Link>
            )}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white lg:hidden"
            style={{ border: "1px solid rgba(255,255,255,0.15)" }}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            Menu
          </button>
        </div>

        {menuOpen ? (
          <nav
            className="mt-3 space-y-1 rounded-xl p-3 lg:hidden"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {APP_NAV_LINKS.map((link) => {
              const active = isNavLinkActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium"
                  style={{
                    color: active ? "#00C6A7" : "rgba(255,255,255,0.75)",
                    background: active ? "rgba(0,198,167,0.1)" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="flex items-center justify-between gap-2 px-1 py-1">
              <span className="text-xs font-medium text-white/50">Sounds</span>
              <SoundToggleButton />
            </div>
            {user ? (
              <button
                type="button"
                onClick={onLogout}
                className="mt-1 flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: "#00C6A7" }}
              >
                Logout
              </button>
            ) : (
              <Link
                href="/auth"
                className="mt-1 flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-center text-sm font-semibold text-white"
                style={{ background: "#00C6A7" }}
              >
                Login
              </Link>
            )}
          </nav>
        ) : null}
      </Container>
    </header>
  );
}
