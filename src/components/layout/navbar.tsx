"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SoundToggleButton } from "@/components/effects/sound-toggle-button";
import { APP_NAV_LINKS, isNavLinkActive } from "@/lib/app-nav-links";
import { Container } from "@/components/ui/container";

// Rendered only for signed-out visitors — AppShell swaps to AppSidebar once a
// user session is present, so this never needs to know about auth or admin
// roles.
export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
            <SoundToggleButton />
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
            <div className="flex items-center justify-between gap-2 px-1 py-1">
              <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>Sounds</span>
              <SoundToggleButton />
            </div>
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
          </nav>
        ) : null}
      </Container>
    </header>
  );
}
