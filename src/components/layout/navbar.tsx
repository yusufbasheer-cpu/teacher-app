"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Container } from "@/components/ui/container";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/lesson-plan", label: "Generate Lesson Plan" },
  { href: "/differentiated-worksheets", label: "Differentiated Worksheet Pack" },
  { href: "/my-lesson-plans", label: "My Lessons" },
];

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
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center">
            <img
              src="/Logo.png"
              alt="Layah"
              height={40}
              className="h-10 w-auto"
              style={{ height: 40, width: "auto" }}
            />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium transition"
                  style={{
                    color: active ? "#00C6A7" : "rgba(255,255,255,0.7)",
                    background: active ? "rgba(0,198,167,0.1)" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
            {user ? (
              <button
                type="button"
                onClick={onLogout}
                className="ml-2 inline-flex min-h-10 items-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "#00C6A7" }}
              >
                Logout
              </button>
            ) : (
              <Link
                href="/auth"
                className="ml-2 inline-flex min-h-10 items-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "#00C6A7" }}
              >
                Login
              </Link>
            )}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex min-h-11 min-w-[4.5rem] items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white md:hidden"
            style={{ border: "1px solid rgba(255,255,255,0.15)" }}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            Menu
          </button>
        </div>

        {menuOpen ? (
          <nav
            className="mt-3 space-y-1 rounded-xl p-3 md:hidden"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium"
                style={{
                  color: pathname === link.href ? "#00C6A7" : "rgba(255,255,255,0.75)",
                  background: pathname === link.href ? "rgba(0,198,167,0.1)" : "transparent",
                }}
              >
                {link.label}
              </Link>
            ))}
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
