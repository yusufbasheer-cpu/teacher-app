import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { BackButtonLogoutModal } from "@/components/landing/back-button-logout-modal";
import { LessonPlanBento } from "@/components/landing/lesson-plan-bento";
import { HowItWorksTimeline } from "@/components/landing/how-it-works-timeline";
import { StatsSection } from "@/components/home/stats-section";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { TextEffect } from "@/components/motion-primitives/text-effect";
import { BorderTrail } from "@/components/motion-primitives/border-trail";
import { InView } from "@/components/motion-primitives/in-view";
import { BG_SOFT, BORDER, NAVY, TEAL, TEAL_DARK, TEXT_MUTED } from "@/lib/design-tokens";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";

const FADE_UP = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
} as const;

export const metadata: Metadata = {
  title: "Layah — AI Lesson Planning for Teachers",
  description:
    "Layah generates complete lesson plans, PowerPoint presentations, worksheets, and assessments in seconds. Built specifically for teachers.",
};

const TRUST_BADGES = ["CBSE", "ICSE", "IB", "Cambridge"] as const;

const FOOTER_PRODUCT_LINKS = [
  { href: "/lesson-plan", label: "Lesson Plans" },
  { href: "/differentiated-worksheets", label: "Worksheets" },
  { href: "/question-paper", label: "Question Papers" },
  { href: "/pricing", label: "Pricing" },
] as const;

const FOOTER_COMPANY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <BackButtonLogoutModal />
      <Navbar />

      <main>
        {/* ══════════════════════════════════════════════════════════════
            HERO — full-bleed background, content column capped at 820px
            ══════════════════════════════════════════════════════════════ */}
        <section className="relative isolate overflow-hidden">
          <img
            src="/hero-blob.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
          />
          <div className="mx-auto max-w-[820px] px-4 pb-10 pt-14 text-center sm:px-6">
            <span
              className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide"
              style={{ background: "color-mix(in oklch, var(--brand) 10%, transparent)", color: TEAL_DARK }}
            >
              AI for Teachers
            </span>

            <TextEffect
              as="h1"
              preset="fade-in-blur"
              speedReveal={1.1}
              speedSegment={0.3}
              className="mt-5 font-extrabold leading-[1.1] tracking-tight"
              style={{ color: NAVY, fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
            >
              Layah creates lesson plans, PPTs, worksheets, and assessments in minutes
            </TextEffect>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: TEXT_MUTED }}>
              Generate curriculum-aligned teaching resources for <strong style={{ color: NAVY }}>CBSE, ICSE, IB, Cambridge, and 15+ more curriculums</strong> from
              a topic, chapter, or textbook page.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/lesson-plan"
                className={`relative inline-flex min-h-12 w-full items-center justify-center rounded-full px-8 text-base font-semibold text-white shadow-[0_8px_24px_-8px_color-mix(in oklch, var(--brand) 55%, transparent)] transition hover:opacity-90 hover:shadow-[0_10px_28px_-6px_color-mix(in oklch, var(--brand) 65%, transparent)] sm:w-auto ${FOCUS_RING}`}
                style={{ background: TEAL }}
              >
                <BorderTrail
                  className="bg-[var(--text)]"
                  size={50}
                  style={{
                    boxShadow:
                      "0 0 10px 2px color-mix(in oklch, var(--text) 55%, transparent), 0 0 20px 6px color-mix(in oklch, var(--text) 25%, transparent)",
                  }}
                />
                Start Generating
              </Link>
              <a
                href="#preview"
                className={`inline-flex min-h-12 w-full items-center justify-center rounded-full px-8 text-base font-semibold transition hover:border-[color-mix(in_oklch,var(--brand)_40%,transparent)] hover:bg-surface sm:w-auto ${FOCUS_RING}`}
                style={{ border: `1px solid ${BORDER}`, color: NAVY, background: "var(--surface-raised)" }}
              >
                View Sample Package
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              {TRUST_BADGES.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full px-3.5 py-1.5 text-xs font-bold"
                  style={{ background: "var(--surface-raised)", border: `1px solid ${BORDER}`, color: TEXT_MUTED }}
                >
                  {badge}
                </span>
              ))}
              <span
                className="rounded-full px-3.5 py-1.5 text-xs font-bold"
                style={{ background: "color-mix(in oklch, var(--brand) 10%, transparent)", border: `1px solid ${BORDER}`, color: TEAL_DARK }}
              >
                +15 more
              </span>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            PRODUCT PREVIEW — 3-card feature grid
            ══════════════════════════════════════════════════════════════ */}
        <section id="preview" className="mx-auto max-w-6xl px-4 py-[72px] sm:px-6 lg:px-8">
          <InView
            variants={FADE_UP}
            viewOptions={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-2xl font-extrabold sm:text-3xl" style={{ color: NAVY }}>
              See what teachers receive
            </h2>
            <p className="mt-3 text-base" style={{ color: TEXT_MUTED }}>
              One generation produces a complete, classroom-ready package.
            </p>
          </InView>

          <div className="mt-10">
            <LessonPlanBento />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            TESTIMONIALS — teacher social proof
            ══════════════════════════════════════════════════════════════ */}
        <TestimonialsSection />

        {/* ══════════════════════════════════════════════════════════════
            STATS — factual product coverage numbers as the social-proof beat
            ══════════════════════════════════════════════════════════════ */}
        <StatsSection />

        {/* ══════════════════════════════════════════════════════════════
            HOW IT WORKS — 3 horizontal numbered steps
            ══════════════════════════════════════════════════════════════ */}
        <section className="py-[72px]" style={{ background: BG_SOFT, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <InView
              variants={FADE_UP}
              viewOptions={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mx-auto max-w-2xl text-center"
            >
              <h2 className="text-2xl font-extrabold sm:text-3xl" style={{ color: NAVY }}>
                How it works
              </h2>
              <p className="mt-3 text-base" style={{ color: TEXT_MUTED }}>
                From blank page to a complete teaching package in three steps.
              </p>
            </InView>

            <HowItWorksTimeline />

            <div className="mt-12 text-center">
              <Link
                href="/lesson-plan"
                className={`relative inline-flex min-h-12 items-center justify-center rounded-full px-8 text-base font-semibold text-white shadow-[0_8px_24px_-8px_color-mix(in oklch, var(--brand) 55%, transparent)] transition hover:opacity-90 hover:shadow-[0_10px_28px_-6px_color-mix(in oklch, var(--brand) 65%, transparent)] ${FOCUS_RING}`}
                style={{ background: TEAL }}
              >
                Start Generating
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ══════════════════════════════════════════════════════════════════
          FOOTER — simplified, homepage-specific (the shared Footer
          component is intentionally left untouched — it's also used on
          /about, /contact, /pricing, /blog, /faq).
          ══════════════════════════════════════════════════════════════════ */}
      <footer className="py-14" style={{ borderTop: `1px solid ${BORDER}` }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 sm:gap-8">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                Product
              </h3>
              <ul className="mt-4 space-y-2.5">
                {FOOTER_PRODUCT_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={`rounded text-sm transition hover:opacity-70 ${FOCUS_RING}`} style={{ color: "var(--text)" }}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                Company
              </h3>
              <ul className="mt-4 space-y-2.5">
                {FOOTER_COMPANY_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={`rounded text-sm transition hover:opacity-70 ${FOCUS_RING}`} style={{ color: "var(--text)" }}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-12 text-xs" style={{ color: TEXT_MUTED }}>
            © 2026 Layah. Built for teachers.
          </p>
        </div>
      </footer>
    </div>
  );
}
