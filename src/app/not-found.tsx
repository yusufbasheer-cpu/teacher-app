import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Page Not Found", robots: { index: false } };

const LINK_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--canvas)]";

const PUBLIC_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export default function NotFound() {
  return (
    <main className="min-h-[70vh] pb-16 pt-16">
      <Container>
        <div className="mx-auto max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm md:p-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">404</p>
          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">Page not found</h1>
          <p className="mt-3 text-sm text-muted">
            The link may be broken or the page was moved. Head back home or try one of these pages.
          </p>
          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--text)] px-5 py-2.5 text-sm font-semibold text-[var(--surface)] transition hover:opacity-90"
            >
              Back to home
            </Link>
          </div>
          <nav aria-label="Popular pages" className="mt-4 flex flex-wrap justify-center gap-3">
            {PUBLIC_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={LINK_CLASS}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </main>
  );
}
