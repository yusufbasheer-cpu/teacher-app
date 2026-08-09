"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isNavLinkActive } from "@/lib/app-nav-links";
import { BORDER, NAVY, TEAL, TEXT_MUTED } from "@/lib/design-tokens";

// Rendered only for signed-out visitors — AppShell swaps to AppSidebar once a
// user session is present, so this never needs to know about auth or admin
// roles. Same header markup as /landing (which renders this component too),
// so there is exactly one public-facing nav bar in the app.
const NAV_LINKS = [
  { href: "/lesson-plan", label: "Lesson Plans" },
  { href: "/differentiated-worksheets", label: "Worksheets" },
  { href: "/question-paper", label: "Question Papers" },
  { href: "/pricing", label: "Pricing" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className="sticky top-0 z-50 bg-white/90 backdrop-blur"
      style={{ borderBottom: `1px solid ${BORDER}` }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/landing" className="flex shrink-0 items-center gap-2.5">
          <img src="/logo-mark.png" alt="Layah" className="h-9 w-9 rounded-xl object-cover" />
          <span className="leading-tight">
            <span className="block text-[15px] font-extrabold" style={{ color: NAVY }}>
              Layah
            </span>
            <span className="block text-[11px] font-semibold" style={{ color: TEXT_MUTED }}>
              Teacher AI Suite
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isNavLinkActive(pathname, link.href) ? "page" : undefined}
              className="rounded-full px-3.5 py-2 text-sm font-medium transition hover:bg-slate-50"
              style={{
                color: isNavLinkActive(pathname, link.href) ? "#0A8F7A" : "#374151",
                background: isNavLinkActive(pathname, link.href) ? "rgba(0,198,167,0.08)" : "transparent",
                fontWeight: isNavLinkActive(pathname, link.href) ? 600 : 500,
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-70"
            style={{ color: "#374151" }}
          >
            Login
          </Link>
          <Link
            href="/lesson-plan"
            className="rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: TEAL }}
          >
            Start Generating
          </Link>
        </div>

        {/* Mobile: hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg lg:hidden"
          style={{ border: `1px solid ${BORDER}`, color: "#374151" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {menuOpen ? (
          <div
            className="fixed inset-x-0 top-16 flex flex-col gap-1 bg-white p-4 shadow-md lg:hidden"
            style={{ borderBottom: `1px solid ${BORDER}` }}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium"
                style={{
                  color: isNavLinkActive(pathname, link.href) ? "#0A8F7A" : "#374151",
                  background: isNavLinkActive(pathname, link.href) ? "rgba(0,198,167,0.08)" : "transparent",
                }}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t pt-3" style={{ borderColor: BORDER }}>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2.5 text-center text-sm font-semibold"
                style={{ color: "#374151", border: `1px solid ${BORDER}` }}
              >
                Login
              </Link>
              <Link
                href="/lesson-plan"
                className="rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-white"
                style={{ background: TEAL }}
              >
                Start Generating
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
