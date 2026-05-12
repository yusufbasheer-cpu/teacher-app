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
    <header className="sticky top-0 z-50 border-b border-blue-100/80 bg-white/90 backdrop-blur-md">
      <Container className="py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-sm font-bold text-white shadow-sm">
              E
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              EduPlan AI
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {user ? (
              <button
                type="button"
                onClick={onLogout}
                className="ml-2 inline-flex min-h-10 items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/auth"
                className="ml-2 inline-flex min-h-10 items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Login
              </Link>
            )}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex min-h-11 min-w-[4.5rem] items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            Menu
          </button>
        </div>

        {menuOpen ? (
          <nav className="mt-3 space-y-1 rounded-xl border border-blue-100 bg-white p-3 md:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium ${
                  pathname === link.href
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <button
                type="button"
                onClick={onLogout}
                className="mt-1 flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/auth"
                className="mt-1 flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-center text-sm font-semibold text-white"
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
