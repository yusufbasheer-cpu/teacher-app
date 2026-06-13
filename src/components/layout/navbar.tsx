"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { SoundToggleButton } from "@/components/effects/sound-toggle-button";
import { clearActiveSession } from "@/lib/active-session";
import { APP_NAV_LINKS, SCHOOL_ADMIN_NAV_LINK, SUPER_ADMIN_NAV_LINK, HOD_DASHBOARD_NAV_LINK, isNavLinkActive } from "@/lib/app-nav-links";
import { supabase } from "@/lib/supabase";
import { Container } from "@/components/ui/container";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isHod, setIsHod] = useState(false);

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
    const checkAdmin = async () => {
      if (!user) {
        setIsSchoolAdmin(false);
        setIsSuperAdmin(false);
        setIsHod(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setIsSchoolAdmin(false);
        setIsSuperAdmin(false);
        setIsHod(false);
        return;
      }

      try {
        const [schoolRes, superRes, hodRes] = await Promise.all([
          fetch("/api/school-admin/me", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch("/api/super-admin/me"),
          fetch("/api/hod/me", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);
        const schoolBody = (await schoolRes.json()) as { isAdmin?: boolean };
        const superBody = (await superRes.json()) as { isSuperAdmin?: boolean };
        const hodBody = (await hodRes.json()) as { isHod?: boolean };
        setIsSchoolAdmin(Boolean(schoolBody.isAdmin));
        setIsSuperAdmin(Boolean(superBody.isSuperAdmin));
        setIsHod(Boolean(hodBody.isHod));
      } catch {
        setIsSchoolAdmin(false);
        setIsSuperAdmin(false);
        setIsHod(false);
      }
    };

    void checkAdmin();
  }, [user]);

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

  const navLinkStyle = (href: string) => ({
    color: isNavLinkActive(pathname, href) ? "#00C6A7" : "#374151",
    background: isNavLinkActive(pathname, href) ? "rgba(0,198,167,0.08)" : "transparent",
    fontWeight: isNavLinkActive(pathname, href) ? 600 : 500,
  });

  return (
    <header
      className="sticky top-0 z-50"
      style={{ background: "#FFFFFF", borderBottom: "2px solid rgba(0,198,167,0.25)" }}
    >
      <Container className="py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex shrink-0 items-center">
            <div className="rounded-xl px-2 py-1" style={{ background: "#0A1628" }}>
              <img
                src="/Logo.png"
                alt="Layah"
                height={32}
                className="h-8 w-auto"
                style={{ height: 32, width: "auto" }}
              />
            </div>
          </Link>

          <nav className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-1 lg:flex">
            {APP_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-xl px-3 py-2 text-sm transition"
                style={navLinkStyle(link.href)}
              >
                {link.label}
              </Link>
            ))}
            {isSchoolAdmin ? (
              <Link
                href={SCHOOL_ADMIN_NAV_LINK.href}
                className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-xl px-3 py-2 text-sm transition"
                style={navLinkStyle(SCHOOL_ADMIN_NAV_LINK.href)}
              >
                {SCHOOL_ADMIN_NAV_LINK.label}
              </Link>
            ) : null}
            {isHod ? (
              <Link
                href={HOD_DASHBOARD_NAV_LINK.href}
                className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-xl px-3 py-2 text-sm transition"
                style={navLinkStyle(HOD_DASHBOARD_NAV_LINK.href)}
              >
                {HOD_DASHBOARD_NAV_LINK.label}
              </Link>
            ) : null}
            {isSuperAdmin ? (
              <Link
                href={SUPER_ADMIN_NAV_LINK.href}
                className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition"
                style={{
                  color: isNavLinkActive(pathname, SUPER_ADMIN_NAV_LINK.href) ? "#f87171" : "#ef4444",
                  background: isNavLinkActive(pathname, SUPER_ADMIN_NAV_LINK.href) ? "rgba(248,113,113,0.08)" : "transparent",
                }}
              >
                {SUPER_ADMIN_NAV_LINK.label}
              </Link>
            ) : null}
            <SoundToggleButton />
            {user ? (
              <>
                <Link
                  href="/lesson-plan"
                  className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-xl px-3 py-2 text-sm transition"
                  style={navLinkStyle("/lesson-plan")}
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="ml-1 inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: "#00C6A7" }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth"
                  className="ml-1 inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition hover:opacity-70"
                  style={{ color: "#374151" }}
                >
                  Login
                </Link>
                <Link
                  href="/auth?tab=signup"
                  className="ml-1 inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: "#00C6A7" }}
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-3 py-2 text-sm font-medium lg:hidden"
            style={{ border: "1px solid #E5E7EB", color: "#374151" }}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            Menu
          </button>
        </div>

        {menuOpen ? (
          <nav
            className="mt-3 space-y-1 rounded-2xl p-3 lg:hidden"
            style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}
          >
            {APP_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-11 items-center rounded-xl px-3 py-2 text-sm transition"
                style={navLinkStyle(link.href)}
              >
                {link.label}
              </Link>
            ))}
            {isSchoolAdmin ? (
              <Link
                href={SCHOOL_ADMIN_NAV_LINK.href}
                className="flex min-h-11 items-center rounded-xl px-3 py-2 text-sm transition"
                style={navLinkStyle(SCHOOL_ADMIN_NAV_LINK.href)}
              >
                {SCHOOL_ADMIN_NAV_LINK.label}
              </Link>
            ) : null}
            {isHod ? (
              <Link
                href={HOD_DASHBOARD_NAV_LINK.href}
                className="flex min-h-11 items-center rounded-xl px-3 py-2 text-sm transition"
                style={navLinkStyle(HOD_DASHBOARD_NAV_LINK.href)}
              >
                {HOD_DASHBOARD_NAV_LINK.label}
              </Link>
            ) : null}
            {isSuperAdmin ? (
              <Link
                href={SUPER_ADMIN_NAV_LINK.href}
                className="flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-medium transition"
                style={{ color: "#ef4444" }}
              >
                {SUPER_ADMIN_NAV_LINK.label}
              </Link>
            ) : null}
            <div className="flex items-center justify-between gap-2 px-1 py-1">
              <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>Sounds</span>
              <SoundToggleButton />
            </div>
            {user ? (
              <>
                <Link
                  href="/lesson-plan"
                  className="flex min-h-11 items-center rounded-xl px-3 py-2 text-sm transition"
                  style={navLinkStyle("/lesson-plan")}
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="mt-1 flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: "#00C6A7" }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth"
                  className="flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-medium transition"
                  style={{ color: "#374151" }}
                >
                  Login
                </Link>
                <Link
                  href="/auth?tab=signup"
                  className="mt-1 flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-center text-sm font-semibold text-white"
                  style={{ background: "#00C6A7" }}
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        ) : null}
      </Container>
    </header>
  );
}
