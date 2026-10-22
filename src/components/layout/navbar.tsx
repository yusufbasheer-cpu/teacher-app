"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { isNavLinkActive } from "@/lib/app-nav-links";
import { BORDER, NAVY, TEAL, TEXT_MUTED } from "@/lib/design-tokens";
import { isFeatureVisible } from "@/lib/experiment-feature-lock";

// Rendered for signed-out visitors and for signed-in visitors on public
// pages — AppShell swaps to AppFrame (the dashboard rail) only on actual
// dashboard routes. Same header markup as `/` (the homepage, which renders
// this component too), so there is exactly one public-facing nav bar in the app.
const NAV_LINKS = [
  { href: "/lesson-plan", label: "Lesson Plans" },
  { href: "/differentiated-worksheets", label: "Worksheets" },
  { href: "/question-paper", label: "Question Papers" },
  { href: "/pricing", label: "Pricing" },
].filter((link) => isFeatureVisible(link.href));

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // While the mobile menu is open: Escape closes it (focus returns to the
  // toggle) and the page behind it must not scroll.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      toggleRef.current?.focus();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 bg-[color-mix(in_oklch,var(--surface)_90%,transparent)] backdrop-blur transition-shadow duration-300 ${
        scrolled ? "shadow-[0_1px_0_color-mix(in oklch, var(--text) 6%, transparent),0_8px_24px_-16px_color-mix(in oklch, var(--text) 25%, transparent)]" : ""
      }`}
      style={{ borderBottom: `1px solid ${BORDER}` }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Layah home" className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg ${FOCUS_RING}`}>
          <Image src="/logo-mark.png" alt="Layah" width={36} height={36} priority className="h-9 w-9 rounded-xl object-cover" />
          <span className="leading-tight">
            <span className="block text-[15px] font-extrabold" style={{ color: NAVY }}>
              Layah
            </span>
            <span className="block text-[11px] font-semibold" style={{ color: TEXT_MUTED }}>
              Prep Less. Teach More.
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isNavLinkActive(pathname, link.href) ? "page" : undefined}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition hover:bg-hover ${FOCUS_RING}`}
              style={{
                color: isNavLinkActive(pathname, link.href) ? "var(--brand-active)" : "var(--text)",
                background: isNavLinkActive(pathname, link.href) ? "color-mix(in oklch, var(--brand) 8%, transparent)" : "transparent",
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
            className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-70 ${FOCUS_RING}`}
            style={{ color: "var(--text)" }}
          >
            Login
          </Link>
          <Link
            href="/lesson-plan"
            className={`rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 hover:shadow-md ${FOCUS_RING}`}
            style={{ background: TEAL }}
          >
            Start Generating
          </Link>
        </div>

        {/* Mobile: hamburger */}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg lg:hidden ${FOCUS_RING}`}
          style={{ border: `1px solid ${BORDER}`, color: "var(--text)" }}
        >
          {menuOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
        </button>

        {menuOpen ? (
          <div
            id="mobile-nav"
            className="fixed inset-x-0 top-16 flex flex-col gap-1 bg-[var(--surface)] p-4 shadow-md lg:hidden"
            style={{ borderBottom: `1px solid ${BORDER}` }}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${FOCUS_RING}`}
                style={{
                  color: isNavLinkActive(pathname, link.href) ? "var(--brand-active)" : "var(--text)",
                  background: isNavLinkActive(pathname, link.href) ? "color-mix(in oklch, var(--brand) 8%, transparent)" : "transparent",
                }}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t pt-3" style={{ borderColor: BORDER }}>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className={`flex min-h-11 items-center justify-center rounded-lg px-3 text-center text-sm font-semibold ${FOCUS_RING}`}
                style={{ color: "var(--text)", border: `1px solid ${BORDER}` }}
              >
                Login
              </Link>
              <Link
                href="/lesson-plan"
                onClick={() => setMenuOpen(false)}
                className={`flex min-h-11 items-center justify-center rounded-lg px-3 text-center text-sm font-semibold text-white ${FOCUS_RING}`}
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
